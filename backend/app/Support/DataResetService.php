<?php

namespace App\Support;

use App\Modules\Inventory\Models\Category;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DataResetService
{
    /** Business tables wiped; users, stores, and auth tokens stay. */
    private const TABLES = [
        'sale_return_lines',
        'sale_returns',
        'sale_payments',
        'sale_lines',
        'sales',
        'purchase_return_lines',
        'purchase_returns',
        'purchase_lines',
        'purchases',
        'vendor_payments',
        'customer_ledger_entries',
        'stock_write_offs',
        'stock_movements',
        'products',
        'categories',
        'customers',
        'vendors',
        'till_sessions',
        'tasks',
        'sync_log',
        'settings',
    ];

    public static function defaultCategoryNames(): array
    {
        return [
            'Grocery',
            'Dairy',
            'Beverages',
            'Snacks & Biscuits',
            'Rice & Pulses',
            'Spices & Masala',
            'Cooking Oil',
            'Personal Care',
            'Household & Cleaning',
            'Frozen',
        ];
    }

    /**
     * @return array{users: int, stores: int, wiped_tables: list<string>}
     */
    public function reset(bool $withCategories = false): array
    {
        $userCount = (int) DB::table('users')->count();
        $storeCount = (int) DB::table('stores')->count();

        DB::transaction(function () use ($withCategories): void {
            $this->wipeBusinessTables();

            if ($withCategories) {
                $this->seedDefaultCategories();
            }
        });

        return [
            'users' => $userCount,
            'stores' => $storeCount,
            'wiped_tables' => self::TABLES,
        ];
    }

    private function wipeBusinessTables(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            $list = implode(', ', self::TABLES);
            DB::statement("TRUNCATE TABLE {$list} RESTART IDENTITY CASCADE");

            return;
        }

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF');
            foreach (self::TABLES as $table) {
                DB::table($table)->delete();
            }
            $quoted = implode(',', array_map(fn (string $t) => "'{$t}'", self::TABLES));
            DB::statement("DELETE FROM sqlite_sequence WHERE name IN ({$quoted})");
            DB::statement('PRAGMA foreign_keys = ON');

            return;
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (self::TABLES as $table) {
            DB::table($table)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    private function seedDefaultCategories(): void
    {
        $storeIds = DB::table('stores')->pluck('id');

        if ($storeIds->isEmpty()) {
            throw new RuntimeException('No store found — users need a store before seeding categories.');
        }

        foreach ($storeIds as $storeId) {
            foreach (self::defaultCategoryNames() as $name) {
                Category::query()->firstOrCreate(
                    ['store_id' => $storeId, 'name' => $name],
                    ['store_id' => $storeId, 'name' => $name],
                );
            }
        }
    }
}
