<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Modules\Sales\Models\Sale;
use App\Modules\Sales\Models\SalePayment;
use App\Modules\Sales\Models\TillSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class TillController extends Controller
{
    public function current(Request $request): JsonResponse
    {
        $session = TillSession::whereNull('closed_at')->latest('opened_at')->first();

        if (! $session) {
            $session = TillSession::create([
                'register_name' => 'POS Register #1',
                'opened_by' => null,
                'opening_float' => 0,
                'opened_at' => now(),
            ]);
        }

        $summary = $this->summary($session);

        // Cashiers count blind: hide every figure that reveals the expected
        // cash (expected = opening float + cash sales) so the physical count
        // cannot be matched to it. Manager/owner reconcile on close.
        if ($request->user()?->role === 'cashier') {
            unset($summary['expected_cash'], $summary['cash_sales'], $summary['opening_float']);
        }

        return response()->json(['data' => $summary]);
    }

    public function close(Request $request): JsonResponse
    {
        $data = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'retained_float' => ['nullable', 'numeric', 'min:0'],
            'denominations' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        $session = TillSession::whereNull('closed_at')->latest('opened_at')->firstOrFail();
        $summary = $this->summary($session);
        $counted = (float) $data['counted_cash'];
        $retained = (float) ($data['retained_float'] ?? 0);

        abort_if($retained > $counted, 422, 'Retained float cannot exceed counted cash.');

        $session->update([
            'expected_cash' => $summary['expected_cash'],
            'counted_cash' => $counted,
            'retained_float' => $retained,
            'handed_over' => $counted - $retained,
            'variance' => $counted - $summary['expected_cash'],
            'denominations' => $data['denominations'] ?? null,
            'notes' => $data['notes'] ?? null,
            'closed_by' => $request->user()?->id,
            'closed_at' => now(),
        ]);

        return response()->json(['data' => $session]);
    }

    private function summary(TillSession $session): array
    {
        $cashSales = (float) SalePayment::where('method', 'cash')
            ->whereHas('sale', fn ($query) => $query->where('sold_at', '>=', $session->opened_at))
            ->sum('amount');

        $card = (float) SalePayment::where('method', 'card')->sum('amount');
        $wallet = (float) SalePayment::where('method', 'wallet')->sum('amount');
        $khata = (float) SalePayment::where('method', 'khata')->sum('amount');
        $expected = (float) $session->opening_float + $cashSales;

        return [
            'id' => $session->id,
            'register_name' => $session->register_name,
            'opened_at' => $session->opened_at?->toIso8601String(),
            'opening_float' => (float) $session->opening_float,
            'cash_sales' => $cashSales,
            'card_total' => $card,
            'wallet_total' => $wallet,
            'khata_total' => $khata,
            'expected_cash' => $expected,
            'sales_count' => Sale::where('sold_at', '>=', $session->opened_at)->count(),
        ];
    }
}
