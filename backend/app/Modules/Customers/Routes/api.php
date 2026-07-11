<?php

use App\Modules\Customers\Http\Controllers\CustomerController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('customers')->group(function () {
    // Cashiers can search customers for POS khata billing.
    Route::get('/', [CustomerController::class, 'index']);

    Route::middleware('role:owner,manager')->group(function () {
        Route::post('/', [CustomerController::class, 'store']);
        Route::put('/{customer}', [CustomerController::class, 'update']);
        Route::get('/{customer}/ledger', [CustomerController::class, 'ledger']);
        Route::post('/{customer}/repayments', [CustomerController::class, 'repayment']);
    });
});