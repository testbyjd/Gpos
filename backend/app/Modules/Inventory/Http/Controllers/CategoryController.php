<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Modules\Inventory\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Category::orderBy('name')->get(['id', 'name', 'updated_at']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'name' => ['required', 'string', 'max:120'],
        ]);

        return response()->json(['data' => Category::create($data)], 201);
    }
}
