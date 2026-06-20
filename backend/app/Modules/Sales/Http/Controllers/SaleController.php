<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Modules\Sales\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sales = Sale::query()
            ->with(['customer', 'cashier:id,name', 'payments'])
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->integer('customer_id')))
            ->latest('sold_at')
            ->paginate(50);

        return response()->json([
            'data' => $sales->items(),
            'meta' => [
                'current_page' => $sales->currentPage(),
                'last_page' => $sales->lastPage(),
                'total' => $sales->total(),
            ],
        ]);
    }

    public function show(Sale $sale): JsonResponse
    {
        $sale->load(['customer', 'cashier:id,name', 'lines.product:id,name,barcode,stock_qty,unit', 'payments']);

        return response()->json(['data' => $sale]);
    }
}
