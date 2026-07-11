<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

/**
 * Full application DB backup as portable JSON (sqlite / mysql / mariadb).
 * Skips cache/queue/session noise; includes users + all business data.
 */
class DatabaseBackupService
{
    public const FORMAT = 'gpos_backup';

    public const VERSION = 1;

    /** Confirm phrase required for destructive import. */
    public const RESTORE_CONFIRM = 'RESTORE';

    /**
     * Parent → child insert order (FK-safe). Missing tables are skipped.
     *
     * @var list<string>
     */
    private const TABLES = [
        'stores',
        'users',
        'categories',
        'vendors',
        'vendor_contacts',
        'customers',
        'products',
        'settings',
        'expense_categories',
        'expenses',
        'purchases',
        'purchase_lines',
        'purchase_returns',
        'purchase_return_lines',
        'vendor_payments',
        'sales',
        'sale_lines',
        'sale_payments',
        'sale_returns',
        'sale_return_lines',
        'customer_ledger_entries',
        'stock_movements',
        'stock_write_offs',
        'till_sessions',
        'tasks',
        'sync_log',
    ];

    /**
     * @return array{
     *   format: string,
     *   version: int,
     *   exported_at: string,
     *   driver: string,
     *   table_counts: array<string, int>,
     *   tables: array<string, list<array<string, mixed>>>
     * }
     */
    public function export(): array
    {
        $tables = [];
        $counts = [];

        foreach (self::TABLES as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $rows = [];
            $query = DB::table($table);
            if (Schema::hasColumn($table, 'id')) {
                $query->orderBy('id');
            }

            $query->chunk(500, function ($chunk) use (&$rows): void {
                foreach ($chunk as $row) {
                    $rows[] = $this->normalizeRow((array) $row);
                }
            });

            $tables[$table] = $rows;
            $counts[$table] = count($rows);
        }

        return [
            'format' => self::FORMAT,
            'version' => self::VERSION,
            'exported_at' => now()->toIso8601String(),
            'driver' => DB::getDriverName(),
            'table_counts' => $counts,
            'tables' => $tables,
        ];
    }

    /**
     * Replace current DB contents with backup. Destructive.
     *
     * @param  array<string, mixed>  $payload
     * @return array{tables_restored: list<string>, row_counts: array<string, int>}
     */
    public function import(array $payload): array
    {
        $this->assertValidPayload($payload);

        /** @var array<string, list<array<string, mixed>>> $tables */
        $tables = $payload['tables'];

        $driver = DB::getDriverName();
        $restored = [];
        $rowCounts = [];

        try {
            $this->withoutForeignKeys($driver, function () use ($tables, &$restored, &$rowCounts): void {
                $this->wipeBackupTables();

                if (Schema::hasTable('personal_access_tokens')) {
                    DB::table('personal_access_tokens')->delete();
                }

                foreach (self::TABLES as $table) {
                    if (! Schema::hasTable($table) || ! isset($tables[$table])) {
                        continue;
                    }

                    $rows = $tables[$table];
                    if (! is_array($rows) || $rows === []) {
                        $restored[] = $table;
                        $rowCounts[$table] = 0;

                        continue;
                    }

                    $columns = Schema::getColumnListing($table);
                    $columnFlip = array_flip($columns);

                    foreach (array_chunk($rows, 200) as $chunk) {
                        $insert = [];
                        foreach ($chunk as $row) {
                            if (! is_array($row)) {
                                continue;
                            }
                            $filtered = array_intersect_key($row, $columnFlip);
                            if ($filtered !== []) {
                                $insert[] = $filtered;
                            }
                        }
                        if ($insert !== []) {
                            DB::table($table)->insert($insert);
                        }
                    }

                    $restored[] = $table;
                    $rowCounts[$table] = count($rows);
                }
            });

            // Resync PK sequences/auto-increment only after the restore has durably
            // committed — doing this mid-transaction can implicitly commit early (MySQL
            // ALTER TABLE) and a failure here must never be mistaken for lost data.
            foreach ($restored as $table) {
                $this->syncAutoIncrement($table);
            }
        } catch (Throwable $e) {
            throw new RuntimeException('Import fail: '.$e->getMessage(), 0, $e);
        }

        return [
            'tables_restored' => $restored,
            'row_counts' => $rowCounts,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function assertValidPayload(array $payload): void
    {
        if (($payload['format'] ?? null) !== self::FORMAT) {
            throw new InvalidArgumentException('Invalid backup file — GPOS backup nahi hai.');
        }

        $version = (int) ($payload['version'] ?? 0);
        if ($version < 1 || $version > self::VERSION) {
            throw new InvalidArgumentException('Backup version support nahi hai (v'.$version.').');
        }

        if (! isset($payload['tables']) || ! is_array($payload['tables'])) {
            throw new InvalidArgumentException('Backup file incomplete — tables missing.');
        }

        // Restore wipes the users table unconditionally — refuse to proceed unless the
        // payload actually has users to put back, or the wipe would lock everyone out.
        $users = $payload['tables']['users'] ?? null;
        if (! is_array($users) || $users === []) {
            throw new InvalidArgumentException('Backup file mein users data missing hai — restore rok diya gaya (lockout se bachne ke liye).');
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row): array
    {
        foreach ($row as $key => $value) {
            if ($value instanceof \DateTimeInterface) {
                $row[$key] = $value->format('Y-m-d H:i:s');
            }
        }

        return $row;
    }

    private function wipeBackupTables(): void
    {
        $driver = DB::getDriverName();
        $existing = array_values(array_filter(
            self::TABLES,
            fn (string $t) => Schema::hasTable($t),
        ));

        // Child → parent delete order
        $wipeOrder = array_reverse($existing);

        if ($driver === 'sqlite') {
            foreach ($wipeOrder as $table) {
                DB::table($table)->delete();
            }
            $quoted = implode(',', array_map(fn (string $t) => "'{$t}'", $existing));
            if ($quoted !== '' && Schema::hasTable('sqlite_sequence')) {
                DB::statement("DELETE FROM sqlite_sequence WHERE name IN ({$quoted})");
            }

            return;
        }

        if ($driver === 'pgsql') {
            if ($existing !== []) {
                DB::statement('TRUNCATE TABLE '.implode(', ', $existing).' RESTART IDENTITY CASCADE');
            }

            return;
        }

        foreach ($wipeOrder as $table) {
            DB::table($table)->delete();
        }
    }

    /**
     * Runs $callback with FK checks suspended and wrapped in a DB transaction, so a
     * failure partway through the wipe+restore rolls back to the pre-import state
     * instead of leaving the database half-wiped.
     *
     * SQLite's `PRAGMA foreign_keys` is a no-op once a transaction is open, so it must
     * be toggled outside DB::transaction() — set it before BEGIN, restore it after
     * COMMIT/ROLLBACK.
     */
    private function withoutForeignKeys(string $driver, callable $callback): void
    {
        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF');
            try {
                DB::transaction($callback);
            } finally {
                DB::statement('PRAGMA foreign_keys = ON');
            }

            return;
        }

        if ($driver === 'pgsql') {
            DB::transaction($callback);

            return;
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            DB::transaction($callback);
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function syncAutoIncrement(string $table): void
    {
        if (! Schema::hasColumn($table, 'id')) {
            return;
        }

        $max = (int) DB::table($table)->max('id');
        if ($max <= 0) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::table('sqlite_sequence')->updateOrInsert(
                ['name' => $table],
                ['seq' => $max],
            );

            return;
        }

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE `'.$table.'` AUTO_INCREMENT = '.($max + 1));

            return;
        }

        if ($driver === 'pgsql') {
            // wipeBackupTables() does `TRUNCATE ... RESTART IDENTITY`, which resets the
            // sequence to 1. Rows are then reinserted with explicit ids (from the
            // backup), which does NOT advance a Postgres sequence — so without this,
            // the very next plain insert (no explicit id) collides with an existing row.
            $sequence = DB::selectOne('select pg_get_serial_sequence(?, ?) as seq', [$table, 'id'])?->seq;
            if ($sequence) {
                DB::statement("select setval('{$sequence}', ?, true)", [$max]);
            }
        }
    }
}
