<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Named 'login' route so the auth middleware can resolve a redirect target
// (this is a token-only API; guests just get a 401 JSON instead of a redirect).
Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))
    ->name('login');
