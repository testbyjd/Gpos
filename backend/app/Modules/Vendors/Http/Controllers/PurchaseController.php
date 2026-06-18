<?php

namespace App\Modules\Vendors\Http\Controllers;

use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PurchaseController extends Controller
{
    public function index(): JsonResponse
    {
        $purchases = Purchase::with(['vendor', 'lines.product'])->latest('received_at')->paginate(50);

        return response()->json([
            'data' => $purchases->items(),
            'meta' => [
                'current_page' => $purchases->currentPage(),
                'last_page' => $purchases->lastPage(),
                'total' => $purchases->total(),
            ],
        ]);
    }

    public function store(Request $request, PurchaseService $service): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'vendor_id' => ['required', 'integer', 'exists:vendors,id'],
            'payment_terms' => ['nullable', 'string', 'max:40'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'received_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'lines.*.barcode' => ['nullable', 'string', 'max:80'],
            'lines.*.name' => ['required_without:lines.*.product_id', 'string', 'max:180'],
            'lines.*.unit' => ['nullable', 'string', 'max:20'],
            'lines.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'lines.*.expiry_date' => ['nullable', 'date'],
            'lines.*.promotion' => ['nullable', 'array'],
        ]);

        $purchase = $service->create($data, $request->user()?->id);

        return response()->json(['data' => $purchase], 201);
    }
}
