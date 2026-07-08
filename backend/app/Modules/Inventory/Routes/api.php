<?php

use App\Modules\Inventory\Http\Controllers\CategoryController;
use App\Modules\Inventory\Http\Controllers\ProductController;
use App\Modules\Inventory\Http\Controllers\WriteOffController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('inventory')->group(function () {
    // Read access is shared: the cashier POS pulls its catalog from here.
    // Cost prices are stripped for cashiers inside ProductResource.
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    // POS may heal truncated barcodes left by the old scanner skip-3 rule.
    Route::post('/products/{product}/heal-barcode', [ProductController::class, 'healBarcode']);

    // Inventory edits are owner/manager only (plan §4.5).
    Route::middleware('role:owner,manager')->group(function () {
        Route::get('/write-offs/reasons', [WriteOffController::class, 'reasons']);
        Route::get('/write-offs', [WriteOffController::class, 'index']);
        Route::post('/write-offs', [WriteOffController::class, 'store']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::match(['put', 'patch'], '/products/{product}', [ProductController::class, 'update']);
        Route::post('/products/{product}/image', [ProductController::class, 'uploadImage']);
        Route::delete('/products/{product}/image', [ProductController::class, 'deleteImage']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    });
});
