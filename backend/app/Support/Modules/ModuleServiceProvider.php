<?php

namespace App\Support\Modules;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class ModuleServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $modulesPath = app_path('Modules');

        if (! is_dir($modulesPath)) {
            return;
        }

        foreach (File::directories($modulesPath) as $moduleDir) {
            $routes = $moduleDir.'/Routes/api.php';
            if (File::exists($routes)) {
                Route::middleware('api')
                    ->prefix('api/v1')
                    ->group($routes);
            }

            $migrations = $moduleDir.'/Database/Migrations';
            if (is_dir($migrations)) {
                $this->loadMigrationsFrom($migrations);
            }
        }
    }
}
