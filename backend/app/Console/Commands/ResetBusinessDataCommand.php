<?php

namespace App\Console\Commands;

use App\Support\DataResetService;
use Illuminate\Console\Command;

class ResetBusinessDataCommand extends Command
{
    protected $signature = 'gpos:reset-data
                            {--force : Skip confirmation prompt}
                            {--with-categories : Re-add default empty product categories}';

    protected $description = 'Delete all business data (sales, stock, khata, etc.) but keep users and store login';

    public function handle(DataResetService $reset): int
    {
        $this->warn('Yeh command sab business data delete karegi:');
        $this->line('  sales, purchases, stock, products, customers, vendors, khata, tasks, sync log, settings');
        $this->info('Rakh liya jayega: users, stores, login tokens');
        $this->newLine();

        if (! $this->option('force') && ! $this->confirm('Pakka? Yeh undo nahi ho sakta.', false)) {
            $this->comment('Cancel.');

            return self::SUCCESS;
        }

        $result = $reset->reset((bool) $this->option('with-categories'));

        $this->info("Done — {$result['users']} user(s) aur {$result['stores']} store(s) safe.");
        $this->line('Wiped: '.count($result['wiped_tables']).' tables (IDs reset — next sale INV-1).');

        if ($this->option('with-categories')) {
            $this->line('Default product categories add ho gayi (empty stock).');
        } else {
            $this->comment('Tip: categories chahiye to `php artisan gpos:reset-data --force --with-categories`');
        }

        $this->comment('POS browser cache / held carts clear kar lena (hard refresh).');

        return self::SUCCESS;
    }
}
