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
            ->when($request->filled('payment_method'), function ($q) use ($request) {
                $method = $request->string('payment_method');
                $q->whereHas('payments', fn ($p) => $p->where('method', $method));
            })
            ->when($request->filled('from'), fn ($q) => $q->where('sold_at', '>=', $request->date('from')->startOfDay()))
            ->when($request->filled('to'), fn ($q) => $q->where('sold_at', '<=', $request->date('to')->endOfDay()))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = trim((string) $request->string('q'));
                if ($term === '') {
                    return;
                }
                $q->where(function ($inner) use ($term) {
                    $inner->where('invoice_no', 'like', '%'.$term.'%')
                        ->orWhereHas('customer', function ($c) use ($term) {
                            $c->where('name', 'like', '%'.$term.'%')
                                ->orWhere('phone', 'like', '%'.$term.'%');
                        });
                });
            })
            ->latest('sold_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $sales->items(),
            'meta' => [
                'current_page' => $sales->currentPage(),
                'last_page' => $sales->lastPage(),
                'total' => $sales->total(),
            ],
        ]);
    }

    public function discountSummary(): JsonResponse
    {
        $todayStart = now()->startOfDay();
        $todayEnd = now()->endOfDay();
        $monthStart = now()->startOfMonth()->startOfDay();

        $todayQuery = Sale::query()
            ->where('discount', '>', 0)
            ->whereBetween('sold_at', [$todayStart, $todayEnd]);

        $todaySales = (clone $todayQuery)
            ->orderByDesc('sold_at')
            ->limit(20)
            ->get(['id', 'invoice_no', 'discount', 'discount_recipient_name', 'discount_reason', 'sold_at']);

        $monthSales = Sale::query()
            ->where('discount', '>', 0)
            ->where('sold_at', '>=', $monthStart);

        return response()->json([
            'today' => [
                'count' => (clone $todayQuery)->count(),
                'discount_total' => (float) (clone $todayQuery)->sum('discount'),
                'sales' => $todaySales->map(fn (Sale $sale) => [
                    'id' => $sale->id,
                    'invoice_no' => $sale->invoice_no,
                    'discount' => (float) $sale->discount,
                    'discount_recipient_name' => $sale->discount_recipient_name,
                    'discount_reason' => $sale->discount_reason,
                    'sold_at' => $sale->sold_at?->toIso8601String(),
                ])->values(),
            ],
            'month' => [
                'count' => (clone $monthSales)->count(),
                'discount_total' => (float) (clone $monthSales)->sum('discount'),
            ],
        ]);
    }

    public function show(Sale $sale): JsonResponse
    {
        $sale->load(['customer', 'cashier:id,name', 'lines.product:id,name,barcode,stock_qty,unit', 'payments']);

        return response()->json(['data' => $sale]);
    }
}
