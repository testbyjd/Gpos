<?php

namespace App\Modules\Vendors\Http\Controllers;

use App\Modules\Vendors\Models\PurchaseReturn;
use App\Modules\Vendors\Services\PurchaseReturnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PurchaseReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $returns = PurchaseReturn::query()
            ->with(['vendor', 'lines.product:id,name,barcode'])
            ->when($request->filled('vendor_id'), fn ($q) => $q->where('vendor_id', $request->integer('vendor_id')))
            ->latest('returned_at')
            ->paginate(50);

        return response()->json([
            'data' => $returns->items(),
            'meta' => [
                'current_page' => $returns->currentPage(),
                'last_page' => $returns->lastPage(),
                'total' => $returns->total(),
            ],
        ]);
    }

    public function store(Request $request, PurchaseReturnService $service): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'vendor_id' => ['required', 'integer', 'exists:vendors,id'],
            'purchase_id' => ['nullable', 'integer', 'exists:purchases,id'],
            'note' => ['nullable', 'string', 'max:255'],
            'returned_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        $return = $service->create($data, $request->user()?->id);

        return response()->json(['data' => $return], 201);
    }

    public function show(PurchaseReturn $purchaseReturn): JsonResponse
    {
        return response()->json([
            'data' => $purchaseReturn->load(['vendor', 'lines.product:id,name,barcode']),
        ]);
    }
}
