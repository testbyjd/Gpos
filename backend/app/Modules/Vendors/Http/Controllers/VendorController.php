<?php

namespace App\Modules\Vendors\Http\Controllers;

use App\Modules\Vendors\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class VendorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $vendors = Vendor::query()
            ->when($request->query('active', '1') !== 'all', fn ($query) => $query->where('is_active', true))
            ->when($q !== '', fn ($query) => $query->where('name', 'ilike', "%{$q}%")->orWhere('phone', 'ilike', "%{$q}%"))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $vendors]);
    }

    public function store(Request $request): JsonResponse
    {
        $vendor = Vendor::create($request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
        ]));

        return response()->json(['data' => $vendor], 201);
    }
}
