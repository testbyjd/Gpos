<?php

namespace App\Modules\Expenses\Http\Controllers;

use App\Modules\Expenses\Models\ExpenseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ExpenseCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $storeId = $request->user()?->store_id;

        $categories = ExpenseCategory::query()
            ->when($request->query('active', '1') !== 'all', fn ($q) => $q->where('is_active', true))
            ->when($storeId, function ($q) use ($storeId) {
                $q->where(function ($inner) use ($storeId) {
                    $inner->whereNull('store_id')->orWhere('store_id', $storeId);
                });
            })
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
        ]);

        $name = trim($data['name']);
        $storeId = $request->user()?->store_id;

        $exists = ExpenseCategory::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->when($storeId, function ($q) use ($storeId) {
                $q->where(function ($inner) use ($storeId) {
                    $inner->whereNull('store_id')->orWhere('store_id', $storeId);
                });
            }, fn ($q) => $q->whereNull('store_id'))
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Yeh category pehle se maujood hai.'], 422);
        }

        $category = ExpenseCategory::create([
            'store_id' => $storeId,
            'name' => $name,
            'is_active' => true,
        ]);

        return response()->json(['data' => $category], 201);
    }

    public function destroy(Request $request, ExpenseCategory $expenseCategory): JsonResponse
    {
        if ($expenseCategory->expenses()->exists()) {
            return response()->json([
                'message' => 'Is category pe expenses hain — pehle unhe move/delete karo.',
            ], 422);
        }

        $expenseCategory->delete();

        return response()->json(['ok' => true]);
    }
}
