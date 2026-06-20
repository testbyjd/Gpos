<?php

namespace App\Modules\Vendors\Services;

use App\Modules\Inventory\Services\StockService;
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

            // We owe the vendor less now.
            $vendor = Vendor::lockForUpdate()->findOrFail($data['vendor_id']);
            $vendor->balance = max(0, (float) bcsub((string) $vendor->balance, (string) $subtotal, 2));
            $vendor->save();

            return $return->load(['vendor', 'lines.product']);
        });
    }
}
