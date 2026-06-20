<?php

namespace App\Modules\Auth\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => User::query()
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role', 'store_id', 'is_active', 'created_at']),
            'settings' => [
                'store_name' => 'Gondal Traders',
                'currency' => 'PKR',
                'timezone' => 'Asia/Karachi',
                'print_bridge' => [
                    ['device' => 'Thermal 80mm', 'connection' => 'localhost:9100', 'state' => 'Ready'],
                    ['device' => 'Cash drawer', 'connection' => 'RJ11 via printer', 'state' => 'Ready'],
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:owner,manager,cashier'],
            'pin' => ['nullable', 'digits_between:4,8'],
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'pin_hash' => isset($data['pin']) ? Hash::make($data['pin']) : null,
            'store_id' => $data['store_id'] ?? null,
            'is_active' => true,
        ]);

        return response()->json(['data' => $user], 201);
    }

    public function updatePassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:6', 'max:120'],
        ]);

        $user->update(['password' => Hash::make($data['password'])]);

        return response()->json([
            'ok' => true,
            'message' => "Password updated for {$user->name}.",
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'email' => ['sometimes', 'required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', 'required', 'in:owner,manager,cashier'],
            'is_active' => ['sometimes', 'boolean'],
            'pin' => ['nullable', 'digits_between:4,8'],
        ]);

        if (array_key_exists('is_active', $data) && $data['is_active'] === false && $request->user()?->id === $user->id) {
            return response()->json(['message' => 'Apna khud ka account disable nahi kar sakte.'], 422);
        }

        $updates = collect($data)->except('pin')->all();

        if (array_key_exists('pin', $data)) {
            $updates['pin_hash'] = $data['pin'] !== null && $data['pin'] !== ''
                ? Hash::make($data['pin'])
                : null;
        }

        $user->update($updates);
        $user->refresh();

        return response()->json([
            'data' => $user->only(['id', 'name', 'email', 'role', 'store_id', 'is_active', 'created_at']),
            'message' => "{$user->name} update ho gaya.",
        ]);
    }
}
