<?php

use App\Modules\Sales\Http\Controllers\TillController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('till')->group(function () {
    Route::get('/current', [TillController::class, 'current']);
    Route::post('/close', [TillController::class, 'close'])->middleware('role:owner,manager');
});
