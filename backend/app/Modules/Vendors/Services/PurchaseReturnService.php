<?php

namespace App\Modules\Vendors\Services;

use App\Modules\Inventory\Services\StockService;
use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\PurchaseReturn;
use App\Modules\Vendors\Models\PurchaseReturnLine;
use App\Modules\Vendors\Models\Vendor;
use Illuminate\Support\Facades\DB;

class PurchaseReturnService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, ?int $userId = null): PurchaseReturn
    {
        return DB::transaction(function () use ($data, $userId) {
            $subtotal = collect($data['lines'])->sum(fn ($line) => (float) $line['qty'] * (float) $line['unit_cost']);

            $return = PurchaseReturn::create([
                'store_id' => $data['store_id'] ?? null,
                'vendor_id' => $data['vendor_id'],
                'purchase_id' => $data['purchase_id'] ?? null,
                'return_no' => 'PR-PENDING',
                'subtotal' => $subtotal,
                'note' => $data['note'] ?? null,
                'returned_at' => $data['returned_at'] ?? now(),
                'created_by' => $userId,
            ]);

            $return->update(['return_no' => 'PR-'.$return->id]);

            foreach ($data['lines'] as $line) {
                $qty = (float) $line['qty'];
                $unitCost = (float) $line['unit_cost'];

                PurchaseReturnLine::create([
                    'purchase_return_id' => $return->id,
                    'product_id' => $line['product_id'],
                    'qty' => $qty,
                    'unit_cost' => $unitCost,
                    'line_total' => $qty * $unitCost,
                ]);

                // Goods leave our shelves back to the vendor.
                $this->stock->record(
                    (int) $line['product_id'],
                    -$qty,
                    'purchase_return',
                    'purchase_return',
                    $return->id,
                    $userId,
                    $return->return_no,
                );
            }

            // We owe the vendor less now. Allow the balance to go negative — a
            // negative balance means the vendor owes US (credit / advance).
            $vendor = Vendor::lockForUpdate()->findOrFail($data['vendor_id']);
            $vendor->balance = (float) bcsub((string) $vendor->balance, (string) $subtotal, 2);
            $vendor->save();

            // Offset the return value against this vendor's open invoices so the
            // per-GRN balances stay consistent with the vendor total. The linked
            // GRN is settled first, then the oldest open invoices.
            $remaining = $subtotal;
            $openInvoices = Purchase::query()
                ->where('vendor_id', $vendor->id)
                ->where('balance_amount', '>', 0)
                ->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$data['purchase_id'] ?? 0])
                ->orderBy('received_at')
                ->lockForUpdate()
                ->get();

            foreach ($openInvoices as $invoice) {
                if ($remaining <= 0) {
                    break;
                }
                $cut = min($remaining, (float) $invoice->balance_amount);
                $invoice->balance_amount = bcsub((string) $invoice->balance_amount, (string) $cut, 2);
                $invoice->save();
                $remaining -= $cut;
            }

            return $return->load(['vendor', 'lines.product']);
        });
    }
}
