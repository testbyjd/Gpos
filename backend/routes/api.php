<?php

use Illuminate\Support\Facades\Route;

/*
| Module routes load from app/Modules/{Name}/Routes/api.php (prefix /api/v1).
| This file holds cross-cutting API routes only.
*/

Route::prefix('v1')->group(function () {
    Route::get('/health', fn () => response()->json([
        'ok' => true,
        'time' => now()->toIso8601String(),
    ]));
});
