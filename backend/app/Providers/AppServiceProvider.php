<?php

namespace App\Providers;

use Illuminate\Support\Facades\Date;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Date::serializeUsing(function (\DateTimeInterface $date): string {
            return Date::instance($date)
                ->timezone(config('app.timezone'))
                ->format('Y-m-d\TH:i:sP');
        });
    }
}
