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
    /** Preferred display order for till payment breakdown. */
    private const METHOD_ORDER = [
        'cash',
        'card',
        'easypaisa',
        'jazzcash',
        'bank_transfer',
        'khata',
        'wallet',
        'cheque',
        'split',
    ];

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
            $summary['payment_breakdown'] = array_values(array_filter(
                $summary['payment_breakdown'],
                fn (array $row) => $row['method'] !== 'cash',
            ));
        }

        return response()->json(['data' => $summary]);
    }

    public function close(Request $request): JsonResponse
    {
        $data = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'retained_float' => ['nullable', 'numeric', 'min:0'],
            'denominations' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'payment_settlements' => ['nullable', 'array'],
            'payment_settlements.*.method' => ['required', 'string', 'max:40'],
            'payment_settlements.*.expected' => ['required', 'numeric', 'min:0'],
            'payment_settlements.*.settled' => ['required', 'numeric', 'min:0'],
            'payment_settlements.*.confirmed' => ['required', 'boolean'],
        ]);

        $session = TillSession::whereNull('closed_at')->latest('opened_at')->firstOrFail();
        $summary = $this->summary($session);
        $counted = (float) $data['counted_cash'];
        $retained = (float) ($data['retained_float'] ?? 0);
        $notes = trim((string) ($data['notes'] ?? ''));
        $cashVariance = $counted - $summary['expected_cash'];

        abort_if($retained > $counted, 422, 'Retained float cannot exceed counted cash.');

        $expectedNonCash = collect($summary['payment_breakdown'])
            ->filter(fn (array $row) => $row['method'] !== 'cash' && (float) $row['amount'] > 0)
            ->keyBy('method');

        $settlementsIn = collect($data['payment_settlements'] ?? [])->keyBy('method');
        $paymentTotals = [];
        $nonCashVariance = false;

        foreach ($expectedNonCash as $method => $row) {
            $settlement = $settlementsIn->get($method);
            if (! $settlement || empty($settlement['confirmed'])) {
                abort(422, ucfirst(str_replace('_', ' ', (string) $method)).' confirm / settle karna lazmi hai.');
            }

            $expected = round((float) $row['amount'], 2);
            $settled = round((float) $settlement['settled'], 2);
            $variance = round($settled - $expected, 2);
            if (abs($variance) >= 0.01) {
                $nonCashVariance = true;
            }

            $paymentTotals[] = [
                'method' => $method,
                'amount' => $expected,
                'expected' => $expected,
                'settled' => $settled,
                'variance' => $variance,
                'confirmed' => true,
            ];
        }

        // Keep cash + zero non-cash rows in the snapshot for reports.
        foreach ($summary['payment_breakdown'] as $row) {
            if ($row['method'] === 'cash') {
                $paymentTotals[] = [
                    'method' => 'cash',
                    'amount' => (float) $row['amount'],
                    'expected' => (float) $row['amount'],
                    'settled' => $counted,
                    'variance' => round($cashVariance, 2),
                    'confirmed' => true,
                ];
            } elseif ((float) $row['amount'] <= 0 && $row['method'] !== 'cash') {
                $paymentTotals[] = [
                    'method' => $row['method'],
                    'amount' => 0,
                    'expected' => 0,
                    'settled' => 0,
                    'variance' => 0,
                    'confirmed' => true,
                ];
            }
        }

        if ((abs($cashVariance) >= 0.01 || $nonCashVariance) && $notes === '') {
            abort(422, 'Cash ya non-cash mein farq hai — notes mein reason likho.');
        }

        $session->update([
            'expected_cash' => $summary['expected_cash'],
            'counted_cash' => $counted,
            'retained_float' => $retained,
            'handed_over' => $counted - $retained,
            'variance' => $cashVariance,
            'denominations' => $data['denominations'] ?? null,
            'payment_totals' => $paymentTotals,
            'notes' => $notes !== '' ? $notes : null,
            'closed_by' => $request->user()?->id,
            'closed_at' => now(),
        ]);

        return response()->json(['data' => $session->fresh()]);
    }

    private function summary(TillSession $session): array
    {
        $openedAt = $session->opened_at;

        $rows = SalePayment::query()
            ->selectRaw('method, SUM(amount) as amount')
            ->whereHas('sale', fn ($query) => $query->where('sold_at', '>=', $openedAt))
            ->groupBy('method')
            ->get()
            ->keyBy('method');

        $breakdown = [];
        foreach (self::METHOD_ORDER as $method) {
            $amount = (float) ($rows[$method]->amount ?? 0);
            // Always show core methods (even at 0) so handover checklist is complete.
            if (in_array($method, ['cash', 'card', 'easypaisa', 'jazzcash', 'bank_transfer', 'khata'], true) || $amount > 0) {
                $breakdown[] = [
                    'method' => $method,
                    'amount' => $amount,
                ];
            }
        }

        // Any unexpected/legacy methods not in METHOD_ORDER.
        foreach ($rows as $method => $row) {
            if (in_array($method, self::METHOD_ORDER, true)) {
                continue;
            }
            $amount = (float) $row->amount;
            if ($amount > 0) {
                $breakdown[] = ['method' => $method, 'amount' => $amount];
            }
        }

        $byMethod = collect($breakdown)->keyBy('method');
        $cashSales = (float) ($byMethod->get('cash')['amount'] ?? 0);
        $card = (float) ($byMethod->get('card')['amount'] ?? 0);
        $digital = (float) (
            ($byMethod->get('easypaisa')['amount'] ?? 0)
            + ($byMethod->get('jazzcash')['amount'] ?? 0)
            + ($byMethod->get('bank_transfer')['amount'] ?? 0)
            + ($byMethod->get('wallet')['amount'] ?? 0)
        );
        $khata = (float) ($byMethod->get('khata')['amount'] ?? 0);
        $expected = (float) $session->opening_float + $cashSales;

        return [
            'id' => $session->id,
            'register_name' => $session->register_name,
            'opened_at' => $session->opened_at?->toIso8601String(),
            'opening_float' => (float) $session->opening_float,
            'cash_sales' => $cashSales,
            'card_total' => $card,
            'wallet_total' => $digital,
            'khata_total' => $khata,
            'payment_breakdown' => $breakdown,
            'expected_cash' => $expected,
            'sales_count' => Sale::where('sold_at', '>=', $openedAt)->count(),
        ];
    }
}
