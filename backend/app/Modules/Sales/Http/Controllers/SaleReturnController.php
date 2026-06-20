<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Modules\Sales\Models\SaleReturn;
use App\Modules\Sales\Services\SaleReturnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SaleReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $returns = SaleReturn::query()
            ->with(['customer', 'lines.product:id,name,barcode'])
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('sale_id'), fn ($q) => $q->where('sale_id', $request->integer('sale_id')))
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

    public function store(Request $request, SaleReturnService $service): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'sale_id' => ['nullable', 'integer', 'exists:sales,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'refund_method' => ['required', 'in:cash,khata'],
            'note' => ['nullable', 'string', 'max:255'],
            'returned_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        if ($data['refund_method'] === 'khata' && empty($data['customer_id'])) {
            return response()->json(['message' => 'Khata refund ke liye customer zaroori hai.'], 422);
        }

        $return = $service->create($data, $request->user()?->id);

        return response()->json(['data' => $return], 201);
    }

    public function show(SaleReturn $saleReturn): JsonResponse
    {
        return response()->json([
            'data' => $saleReturn->load(['customer', 'lines.product:id,name,barcode']),
        ]);
    }
}
