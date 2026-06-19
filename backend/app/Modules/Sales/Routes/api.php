<?php

use App\Modules\Sales\Http\Controllers\SaleController;
use App\Modules\Sales\Http\Controllers\TillController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('till')->group(function () {
    Route::get('/current', [TillController::class, 'current']);
    Route::post('/close', [TillController::class, 'close'])->middleware('role:owner,manager');
});

// Sales history + invoice detail (owner/manager only — admin audit).
Route::middleware(['auth:sanctum', 'role:owner,manager'])->prefix('sales')->group(function () {
    Route::get('/', [SaleController::class, 'index']);
    Route::get('/{sale}', [SaleController::class, 'show']);
});
