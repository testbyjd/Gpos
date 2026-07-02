<?php

namespace App\Modules\Vendors\Services;

use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Inventory\Support\ProductBarcode;
use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\PurchaseLine;
use App\Modules\Vendors\Models\Vendor;
use App\Modules\Vendors\Models\VendorPayment;
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

            $this->logVendorPayment($vendor, $purchase, $paid, $userId, 'Paid at GRN');

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

            $this->logVendorPayment($vendor, $purchase, $additionalPaid, $userId, 'Paid on GRN extension');

            return $purchase->load(['vendor', 'lines.product']);
        });
    }

    public function close(Purchase $purchase): Purchase
    {
        $purchase->update(['receiving_status' => 'closed']);

        return $purchase->fresh(['vendor', 'lines.product']);
    }

    /**
     * Replace all lines on an open GRN — used while receiving is still open.
     *
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function replaceLines(Purchase $purchase, array $lines, ?float $paidAmount = null, ?int $userId = null): Purchase
    {
        $this->assertReceivingOpen($purchase);

        return DB::transaction(function () use ($purchase, $lines, $paidAmount, $userId) {
            $purchase = Purchase::lockForUpdate()->findOrFail($purchase->id);
            $oldBalance = (float) $purchase->balance_amount;

            foreach ($purchase->lines()->orderByDesc('id')->get() as $line) {
                $this->reverseReceiveLine($purchase, $line, $userId);
                $line->delete();
            }

            $lineSubtotal = 0.0;
            foreach ($lines as $line) {
                $lineSubtotal += $this->receiveLine($purchase, $line, $purchase->store_id, $userId);
            }

            $paid = $paidAmount ?? (float) $purchase->paid_amount;
            if ($paid > $lineSubtotal) {
                throw ValidationException::withMessages([
                    'paid_amount' => ['Paid amount GRN total se zyada nahi ho sakta.'],
                ]);
            }

            $purchase->subtotal = round($lineSubtotal, 2);
            $purchase->paid_amount = round($paid, 2);
            $purchase->balance_amount = max(0, round($lineSubtotal - $paid, 2));
            $purchase->save();

            $vendor = Vendor::lockForUpdate()->findOrFail($purchase->vendor_id);
            $newBalance = (float) $purchase->balance_amount;
            $vendor->balance = bcadd(
                (string) $vendor->balance,
                (string) ($newBalance - $oldBalance),
                2,
            );
            $vendor->save();

            return $purchase->load(['vendor', 'lines.product']);
        });
    }

    private function assertReceivingOpen(Purchase $purchase): void
    {
        if ($purchase->receiving_status !== 'open') {
            throw ValidationException::withMessages([
                'purchase' => ['Yeh GRN band hai — ab edit nahi ho sakti.'],
            ]);
        }
    }

    private function reverseReceiveLine(Purchase $purchase, PurchaseLine $line, ?int $userId): void
    {
        $product = Product::lockForUpdate()->findOrFail($line->product_id);
        $qty = (float) $line->qty;
        $unitCost = (float) $line->unit_cost;
        $stock = (float) $product->stock_qty;

        if ($stock + 0.0001 < $qty) {
            throw ValidationException::withMessages([
                'lines' => ["{$product->name}: stock kam hai — GRN line edit nahi ho sakti (sold/adjusted ho chuka)."],
            ]);
        }

        $newStock = round($stock - $qty, 3);
        if ($newStock <= 0) {
            $product->avg_cost = 0;
        } else {
            $currentAvg = (float) $product->avg_cost;
            $product->avg_cost = round((($stock * $currentAvg) - ($qty * $unitCost)) / $newStock, 2);
        }
        $product->stock_qty = $newStock;
        $product->save();

        StockMovement::create([
            'store_id' => $product->store_id,
            'product_id' => $product->id,
            'type' => 'grn_edit_reversal',
            'qty_delta' => -$qty,
            'qty_after' => $product->stock_qty,
            'reference_type' => 'purchase',
            'reference_id' => $purchase->id,
            'user_id' => $userId,
            'note' => 'GRN line reversed before edit',
        ]);
    }

    /** @return float line total added */
    private function receiveLine(Purchase $purchase, array $line, ?int $storeId, ?int $userId): float
    {
        $line['barcode'] = ProductBarcode::normalize($line['barcode'] ?? null);
        $product = $this->resolveProductForReceive($line, $storeId);

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

    private function resolveProductForReceive(array $line, ?int $storeId): Product
    {
        $barcode = $line['barcode'] ?? null;

        if (! empty($line['product_id'])) {
            $product = Product::lockForUpdate()->findOrFail($line['product_id']);
            if ($barcode && ! $product->barcode) {
                $this->assertBarcodeAvailable($barcode, $product->id);
                $product->barcode = $barcode;
                $product->save();
            }

            return $product;
        }

        if ($barcode) {
            $existing = ProductBarcode::applyMatch(Product::query()->lockForUpdate(), $barcode)->first();
            if ($existing) {
                return $existing;
            }
        }

        if (empty($line['name'])) {
            throw ValidationException::withMessages([
                'lines' => ['Product name ya barcode required hai.'],
            ]);
        }

        if ($barcode) {
            $this->assertBarcodeAvailable($barcode);
        }

        $product = Product::create([
            'store_id' => $storeId,
            'category_id' => $line['category_id'] ?? null,
            'barcode' => $barcode,
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

        return $product;
    }

    private function assertBarcodeAvailable(string $barcode, ?int $ignoreProductId = null): void
    {
        $query = ProductBarcode::applyMatch(Product::query(), $barcode);
        if ($ignoreProductId) {
            $query->where('id', '!=', $ignoreProductId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'barcode' => ["Barcode {$barcode} pehle se kisi product par hai — duplicate inventory nahi ban sakti."],
            ]);
        }
    }

    private function logVendorPayment(
        Vendor $vendor,
        Purchase $purchase,
        float $amount,
        ?int $userId,
        string $note,
    ): void {
        if ($amount <= 0) {
            return;
        }

        VendorPayment::create([
            'vendor_id' => $vendor->id,
            'purchase_id' => $purchase->id,
            'amount' => round($amount, 2),
            'note' => $note,
            'created_by' => $userId,
        ]);
    }
}
