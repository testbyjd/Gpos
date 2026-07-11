<?php

use App\Modules\Sales\Http\Controllers\SaleController;
use App\Modules\Sales\Http\Controllers\SaleReturnController;
use App\Modules\Sales\Http\Controllers\TillController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('till')->group(function () {
    Route::get('/current', [TillController::class, 'current']);
    Route::post('/close', [TillController::class, 'close'])->middleware('role:owner,manager');
});

// Sales history + invoice detail (POS return ke liye cashier bhi).
Route::middleware(['auth:sanctum', 'role:owner,manager,cashier'])->prefix('sales')->group(function () {
    Route::get('/', [SaleController::class, 'index']);
    Route::get('/discount-summary', [SaleController::class, 'discountSummary'])->middleware('role:owner,manager');
    Route::get('/{sale}', [SaleController::class, 'show']);
});

// Sale returns / refunds (POS cashier bhi return kar sakta hai).
Route::middleware(['auth:sanctum', 'role:owner,manager,cashier'])->prefix('sale-returns')->group(function () {
    Route::get('/', [SaleReturnController::class, 'index'])->middleware('role:owner,manager');
    Route::post('/', [SaleReturnController::class, 'store']);
    Route::get('/{saleReturn}', [SaleReturnController::class, 'show'])->middleware('role:owner,manager');
});
