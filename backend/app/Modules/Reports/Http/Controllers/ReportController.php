<?php

namespace App\Modules\Reports\Http\Controllers;

use App\Modules\Customers\Models\Customer;
use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockWriteOff;
use App\Modules\Sales\Models\Sale;
use App\Modules\Sales\Models\SaleLine;
use App\Modules\Sales\Models\SalePayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ReportController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $today = now()->startOfDay();
        $sales = Sale::with(['customer', 'payments'])->where('sold_at', '>=', $today)->latest('sold_at')->get();
        $cash = (float) SalePayment::where('method', 'cash')->whereHas('sale', fn ($q) => $q->where('sold_at', '>=', $today))->sum('amount');
        $card = (float) SalePayment::where('method', 'card')->whereHas('sale', fn ($q) => $q->where('sold_at', '>=', $today))->sum('amount');
        $wallet = (float) SalePayment::where('method', 'wallet')->whereHas('sale', fn ($q) => $q->where('sold_at', '>=', $today))->sum('amount');
        $khata = (float) SalePayment::where('method', 'khata')->whereHas('sale', fn ($q) => $q->where('sold_at', '>=', $today))->sum('amount');

        return response()->json([
            'metrics' => [
                'net_sales' => (float) $sales->sum('total'),
                'cash_in_till' => $cash,
                'card_wallet' => $card + $wallet,
                'khata_extended' => $khata,
            ],
            'sales_today' => $sales->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'invoice_no' => $sale->invoice_no,
                'customer' => $sale->customer?->name ?? 'Walk-in Customer',
                'amount' => (float) $sale->total,
                'payment' => $sale->payments->pluck('method')->implode(' + '),
                'sold_at' => $sale->sold_at?->toIso8601String(),
            ])->values(),
            'sales_today_count' => $sales->count(),
            'sales_today_total' => (float) $sales->sum('total'),
            'recent_sales' => $sales->take(8)->map(fn (Sale $sale) => [
                'invoice_no' => $sale->invoice_no,
                'customer' => $sale->customer?->name ?? 'Walk-in Customer',
                'amount' => (float) $sale->total,
                'payment' => $sale->payments->pluck('method')->implode(' + '),
                'time' => $sale->sold_at?->diffForHumans(),
            ])->values(),
            'low_stock' => Product::query()
                ->whereColumn('stock_qty', '<=', 'low_stock_threshold')
                ->where('is_active', true)
                ->orderBy('stock_qty')
                ->limit(8)
                ->get(['id', 'name', 'unit', 'stock_qty', 'low_stock_threshold']),
            'receivable_total' => (float) Customer::sum('balance'),
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $from = $request->date('from')?->startOfDay() ?? now()->startOfDay();
        $to = $request->date('to')?->endOfDay() ?? now()->endOfDay();

        $payments = SalePayment::query()
            ->selectRaw('method, SUM(amount) as amount')
            ->whereHas('sale', fn ($q) => $q->whereBetween('sold_at', [$from, $to]))
            ->groupBy('method')
            ->get()
            ->map(fn ($row) => ['method' => $row->method, 'amount' => (float) $row->amount]);

        $profit = SaleLine::query()
            ->join('products', 'products.id', '=', 'sale_lines.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->join('sales', 'sales.id', '=', 'sale_lines.sale_id')
            ->whereBetween('sales.sold_at', [$from, $to])
            ->selectRaw("COALESCE(categories.name, 'Uncategorized') as category")
            ->selectRaw('SUM(sale_lines.line_total) as sales')
            ->selectRaw('SUM(sale_lines.cost_at_sale * sale_lines.qty) as cost')
            ->selectRaw('SUM(sale_lines.line_total - (sale_lines.cost_at_sale * sale_lines.qty)) as profit')
            ->groupBy('categories.name')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'sales' => (float) $row->sales,
                'cost' => (float) $row->cost,
                'profit' => (float) $row->profit,
                'margin' => (float) $row->sales > 0 ? round(((float) $row->profit / (float) $row->sales) * 100, 1) : 0,
            ]);

        $topItems = SaleLine::query()
            ->join('products', 'products.id', '=', 'sale_lines.product_id')
            ->join('sales', 'sales.id', '=', 'sale_lines.sale_id')
            ->whereBetween('sales.sold_at', [$from, $to])
            ->selectRaw('products.name, products.unit, SUM(sale_lines.qty) as qty, SUM(sale_lines.line_total) as amount')
            ->groupBy('products.name', 'products.unit')
            ->orderByDesc('amount')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'qty' => (float) $row->qty,
                'unit' => $row->unit,
                'amount' => (float) $row->amount,
            ]);

        $writeOffQuery = StockWriteOff::query()->whereBetween('created_at', [$from, $to]);
        $writeOffLoss = (float) (clone $writeOffQuery)->sum('loss_value');
        $writeOffsByReason = (clone $writeOffQuery)
            ->selectRaw('reason, SUM(qty) as qty, SUM(loss_value) as loss')
            ->groupBy('reason')
            ->get()
            ->map(fn ($row) => [
                'reason' => $row->reason,
                'qty' => (float) $row->qty,
                'loss' => (float) $row->loss,
            ]);

        $discountQuery = Sale::query()
            ->where('discount', '>', 0)
            ->whereBetween('sold_at', [$from, $to]);
        $totalDiscount = (float) (clone $discountQuery)->sum('discount');
        $discountCount = (clone $discountQuery)->count();
        $discountsByReason = Sale::query()
            ->where('discount', '>', 0)
            ->whereBetween('sold_at', [$from, $to])
            ->selectRaw("COALESCE(NULLIF(TRIM(discount_reason), ''), 'No reason') as reason")
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(discount) as amount')
            ->groupBy('reason')
            ->orderByDesc('amount')
            ->get()
            ->map(fn ($row) => [
                'reason' => $row->reason,
                'count' => (int) $row->count,
                'amount' => (float) $row->amount,
            ]);
        $recentWriteOffs = StockWriteOff::query()
            ->with('product:id,name,unit')
            ->whereBetween('created_at', [$from, $to])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (StockWriteOff $row) => [
                'id' => $row->id,
                'product' => $row->product?->name,
                'unit' => $row->product?->unit,
                'qty' => (float) $row->qty,
                'loss_value' => (float) $row->loss_value,
                'reason' => $row->reason,
                'note' => $row->note,
                'created_at' => $row->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'gross_sales' => (float) Sale::whereBetween('sold_at', [$from, $to])->sum('total'),
            'gross_profit' => (float) $profit->sum('profit'),
            'total_discount' => $totalDiscount,
            'discount_count' => $discountCount,
            'discounts_by_reason' => $discountsByReason,
            'net_receivable' => (float) Customer::sum('balance'),
            'total_write_off_loss' => $writeOffLoss,
            'write_offs_by_reason' => $writeOffsByReason,
            'recent_write_offs' => $recentWriteOffs,
            'payment_breakdown' => $payments,
            'profit_by_category' => $profit,
            'top_items' => $topItems,
        ]);
    }
}
