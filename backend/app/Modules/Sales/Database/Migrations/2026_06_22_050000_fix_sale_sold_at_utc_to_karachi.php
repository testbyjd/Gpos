<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sales sold_at were stored as UTC wall-clock in timestamp columns while APP_TIMEZONE was UTC.
 * After switching to Asia/Karachi, shift existing rows by +5 hours so display matches PKT.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("UPDATE sales SET sold_at = sold_at + INTERVAL '5 hours' WHERE sold_at IS NOT NULL");
        } elseif ($driver === 'sqlite') {
            DB::statement("UPDATE sales SET sold_at = datetime(sold_at, '+5 hours') WHERE sold_at IS NOT NULL");
        } else {
            DB::statement("UPDATE sales SET sold_at = DATE_ADD(sold_at, INTERVAL 5 HOUR) WHERE sold_at IS NOT NULL");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("UPDATE sales SET sold_at = sold_at - INTERVAL '5 hours' WHERE sold_at IS NOT NULL");
        } elseif ($driver === 'sqlite') {
            DB::statement("UPDATE sales SET sold_at = datetime(sold_at, '-5 hours') WHERE sold_at IS NOT NULL");
        } else {
            DB::statement("UPDATE sales SET sold_at = DATE_SUB(sold_at, INTERVAL 5 HOUR) WHERE sold_at IS NOT NULL");
        }
    }
};
