<?php

use App\Modules\Vendors\Http\Controllers\PurchaseController;
use App\Modules\Vendors\Http\Controllers\PayableController;
use App\Modules\Vendors\Http\Controllers\VendorController;
use Illuminate\Support\Facades\Route;

// Vendors, purchases and payables are owner/manager only (plan §4.5).
Route::middleware(['auth:sanctum', 'role:owner,manager'])->group(function () {
    Route::prefix('vendors')->group(function () {
        Route::get('/', [VendorController::class, 'index']);
        Route::post('/', [VendorController::class, 'store']);
    });

    Route::prefix('purchases')->group(function () {
        Route::get('/', [PurchaseController::class, 'index']);
        Route::post('/', [PurchaseController::class, 'store']);
    });

    Route::get('/payables', [PayableController::class, 'index']);
});
