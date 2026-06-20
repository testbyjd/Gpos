<?php

use App\Modules\Auth\Http\Controllers\AuthController;
use App\Modules\Auth\Http\Controllers\SettingsController;
use App\Modules\Auth\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/verify-pin', [AuthController::class, 'verifyPin']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// User & store-settings management is owner only.
Route::middleware(['auth:sanctum', 'role:owner'])->prefix('users')->group(function () {
    Route::get('/', [UserController::class, 'index']);
    Route::post('/', [UserController::class, 'store']);
    Route::patch('/{user}', [UserController::class, 'update']);
    Route::patch('/{user}/password', [UserController::class, 'updatePassword']);
});

// Receipt template: any signed-in user can read (POS needs it), owner can edit.
Route::middleware('auth:sanctum')->prefix('settings')->group(function () {
    Route::get('/receipt', [SettingsController::class, 'receipt']);
    Route::put('/receipt', [SettingsController::class, 'updateReceipt'])->middleware('role:owner');
});
