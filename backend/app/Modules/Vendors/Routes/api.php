<?php

use App\Modules\Vendors\Http\Controllers\PurchaseController;
use App\Modules\Vendors\Http\Controllers\PurchaseReturnController;
use App\Modules\Vendors\Http\Controllers\PayableController;
use App\Modules\Vendors\Http\Controllers\VendorController;
use Illuminate\Support\Facades\Route;

// Vendors, purchases and payables are owner/manager only (plan §4.5).
Route::middleware(['auth:sanctum', 'role:owner,manager'])->group(function () {
    Route::prefix('vendors')->group(function () {
        Route::get('/', [VendorController::class, 'index']);
        Route::post('/', [VendorController::class, 'store']);
        Route::get('/{vendor}', [VendorController::class, 'show']);
    });

    Route::prefix('purchases')->group(function () {
        Route::get('/', [PurchaseController::class, 'index']);
        Route::post('/', [PurchaseController::class, 'store']);
        Route::get('/{purchase}', [PurchaseController::class, 'show']);
        Route::post('/{purchase}/lines', [PurchaseController::class, 'appendLines']);
        Route::put('/{purchase}/lines', [PurchaseController::class, 'replaceLines']);
        Route::post('/{purchase}/close', [PurchaseController::class, 'close']);
    });

    Route::prefix('purchase-returns')->group(function () {
        Route::get('/', [PurchaseReturnController::class, 'index']);
        Route::post('/', [PurchaseReturnController::class, 'store']);
        Route::get('/{purchaseReturn}', [PurchaseReturnController::class, 'show']);
    });

    Route::get('/payables', [PayableController::class, 'index']);
    Route::post('/payables/payments', [PayableController::class, 'recordPayment']);
});
