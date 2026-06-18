<?php

namespace App\Modules\Vendors\Services;

use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\PurchaseLine;
use App\Modules\Vendors\Models\Vendor;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function create(array $data, ?int $userId = null): Purchase
    {
        return DB::transaction(function () use ($data, $userId) {
            $subtotal = collect($data['lines'])->sum(fn ($line) => (float) $line['qty'] * (float) $line['unit_cost']);
            $paid = (float) ($data['paid_amount'] ?? 0);
            $balance = max(0, $subtotal - $paid);

            $purchase = Purchase::create([
                'store_id' => $data['store_id'] ?? null,
                'vendor_id' => $data['vendor_id'],
                'grn_no' => 'GRN-PENDING',
                'payment_terms' => $data['payment_terms'] ?? 'on_account',
                'subtotal' => $subtotal,
                'paid_amount' => $paid,
                'balance_amount' => $balance,
                'received_at' => $data['received_at'] ?? now(),
                'created_by' => $userId,
            ]);

            $purchase->update(['grn_no' => 'GRN-'.$purchase->id]);

            foreach ($data['lines'] as $line) {
                $product = ! empty($line['product_id'])
                    ? Product::lockForUpdate()->findOrFail($line['product_id'])
                    : Product::query()
                        ->when(! empty($line['barcode']), fn ($query) => $query->where('barcode', $line['barcode']))
                        ->lockForUpdate()
                        ->first();

                if (! $product) {
                    $product = Product::create([
                        'store_id' => $data['store_id'] ?? null,
                        'barcode' => $line['barcode'] ?? null,
                        'name' => $line['name'],
                        'unit' => $line['unit'] ?? 'pcs',
                        'avg_cost' => 0,
                        'sell_price' => (float) ($line['sell_price'] ?? $line['unit_cost']),
                        'stock_qty' => 0,
                        'low_stock_threshold' => 5,
                        'expiry_date' => $line['expiry_date'] ?? null,
                        'is_active' => true,
                    ]);
                    $product->refresh();
                }

                $oldQty = (float) $product->stock_qty;
                $oldAvg = (float) $product->avg_cost;
                $qty = (float) $line['qty'];
                $unitCost = (float) $line['unit_cost'];
                $newQty = $oldQty + $qty;
                $newAvg = $newQty > 0 ? (($oldQty * $oldAvg) + ($qty * $unitCost)) / $newQty : $unitCost;

                $product->avg_cost = round($newAvg, 2);
                $product->stock_qty = round($newQty, 3);
                if (! empty($line['expiry_date'])) {
                    $product->expiry_date = $line['expiry_date'];
                }
                $product->save();

                PurchaseLine::create([
                    'purchase_id' => $purchase->id,
                    'product_id' => $product->id,
                    'qty' => $qty,
                    'unit_cost' => $unitCost,
                    'line_total' => $qty * $unitCost,
                    'old_avg_cost' => $oldAvg,
                    'new_avg_cost' => $product->avg_cost,
                    'expiry_date' => $line['expiry_date'] ?? null,
                    'promotion' => $line['promotion'] ?? null,
                ]);

                StockMovement::create([
                    'store_id' => $product->store_id,
                    'product_id' => $product->id,
                    'type' => 'goods_in',
                    'qty_delta' => $qty,
                    'qty_after' => $product->stock_qty,
                    'reference_type' => 'purchase',
                    'reference_id' => $purchase->id,
                    'user_id' => $userId,
                ]);
            }

            $vendor = Vendor::lockForUpdate()->findOrFail($data['vendor_id']);
            $vendor->balance = bcadd((string) $vendor->balance, (string) $balance, 2);
            $vendor->save();

            return $purchase->load(['vendor', 'lines.product']);
        });
    }
}
