<?php

namespace App\Modules\Vendors\Services;

use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\PurchaseLine;
use App\Modules\Vendors\Models\Vendor;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function create(array $data, ?int $userId = null): Purchase
    {
        if (! empty($data['client_id'])) {
            $existing = Purchase::with(['vendor', 'lines.product'])
                ->where('client_id', $data['client_id'])
                ->first();
            if ($existing) {
                return $existing;
            }
        }

        return DB::transaction(function () use ($data, $userId) {
            $subtotal = collect($data['lines'])->sum(fn ($line) => (float) $line['qty'] * (float) $line['unit_cost']);
            $paid = (float) ($data['paid_amount'] ?? 0);
            $balance = max(0, $subtotal - $paid);

            $purchase = Purchase::create([
                'client_id' => $data['client_id'] ?? null,
                'store_id' => $data['store_id'] ?? null,
                'vendor_id' => $data['vendor_id'],
                'grn_no' => 'GRN-PENDING',
                'payment_terms' => $data['payment_terms'] ?? 'on_account',
                'receiving_status' => ! empty($data['receiving_open']) ? 'open' : 'closed',
                'subtotal' => $subtotal,
                'paid_amount' => $paid,
                'balance_amount' => $balance,
                'received_at' => $data['received_at'] ?? now(),
                'created_by' => $userId,
            ]);

            $purchase->update(['grn_no' => 'GRN-'.$purchase->id]);

            foreach ($data['lines'] as $line) {
                $this->receiveLine($purchase, $line, $data['store_id'] ?? null, $userId);
            }

            $vendor = Vendor::lockForUpdate()->findOrFail($data['vendor_id']);
            $vendor->balance = bcadd((string) $vendor->balance, (string) $balance, 2);
            $vendor->save();

            return $purchase->load(['vendor', 'lines.product']);
        });
    }

    public function appendLines(Purchase $purchase, array $lines, float $additionalPaid = 0, ?int $userId = null): Purchase
    {
        if ($purchase->receiving_status !== 'open') {
            throw ValidationException::withMessages([
                'purchase' => ['Yeh GRN band hai — aur items add nahi ho sakte.'],
            ]);
        }

        return DB::transaction(function () use ($purchase, $lines, $additionalPaid, $userId) {
            $purchase = Purchase::lockForUpdate()->findOrFail($purchase->id);
            $lineSubtotal = 0.0;

            foreach ($lines as $line) {
                $lineSubtotal += $this->receiveLine($purchase, $line, $purchase->store_id, $userId);
            }

            $purchase->subtotal = bcadd((string) $purchase->subtotal, (string) $lineSubtotal, 2);
            $purchase->paid_amount = bcadd((string) $purchase->paid_amount, (string) $additionalPaid, 2);
            $purchase->balance_amount = bcsub((string) $purchase->subtotal, (string) $purchase->paid_amount, 2);
            if ((float) $purchase->balance_amount < 0) {
                $purchase->balance_amount = 0;
            }
            $purchase->save();

            $vendorDelta = bcsub((string) $lineSubtotal, (string) $additionalPaid, 2);
            $vendor = Vendor::lockForUpdate()->findOrFail($purchase->vendor_id);
            $vendor->balance = bcadd((string) $vendor->balance, $vendorDelta, 2);
            $vendor->save();

            return $purchase->load(['vendor', 'lines.product']);
        });
    }

    public function close(Purchase $purchase): Purchase
    {
        $purchase->update(['receiving_status' => 'closed']);

        return $purchase->fresh(['vendor', 'lines.product']);
    }

    /** @return float line total added */
    private function receiveLine(Purchase $purchase, array $line, ?int $storeId, ?int $userId): float
    {
        $product = ! empty($line['product_id'])
            ? Product::lockForUpdate()->findOrFail($line['product_id'])
            : Product::query()
                ->when(! empty($line['barcode']), fn ($query) => $query->where('barcode', $line['barcode']))
                ->lockForUpdate()
                ->first();

        if (! $product) {
            $product = Product::create([
                'store_id' => $storeId,
                'category_id' => $line['category_id'] ?? null,
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

        return $qty * $unitCost;
    }
}
