<?php

namespace App\Modules\Inventory\Services;

use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockMovement;
use RuntimeException;

class StockService
{
    public function deductForSale(int $productId, float $qty, int $saleId, ?int $userId): void
    {
        $product = Product::lockForUpdate()->findOrFail($productId);

        if ((float) $product->stock_qty < $qty) {
            throw new RuntimeException("Insufficient stock for product {$product->name}");
        }

        $product->stock_qty = bcsub((string) $product->stock_qty, (string) $qty, 3);
        $product->save();

        StockMovement::create([
            'store_id' => $product->store_id,
            'product_id' => $product->id,
            'type' => 'sale_out',
            'qty_delta' => -$qty,
            'qty_after' => $product->stock_qty,
            'reference_type' => 'sale',
            'reference_id' => $saleId,
            'user_id' => $userId,
        ]);
    }

    /**
     * Apply a stock change (positive to add, negative to remove) and log a movement.
     * Used by returns and manual adjustments.
     */
    public function record(
        int $productId,
        float $qtyDelta,
        string $type,
        string $referenceType,
        int $referenceId,
        ?int $userId,
        ?string $note = null,
    ): void {
        $product = Product::lockForUpdate()->findOrFail($productId);

        if ($qtyDelta < 0 && (float) $product->stock_qty < abs($qtyDelta)) {
            throw new RuntimeException("Insufficient stock for product {$product->name}");
        }

        $product->stock_qty = bcadd((string) $product->stock_qty, (string) $qtyDelta, 3);
        $product->save();

        StockMovement::create([
            'store_id' => $product->store_id,
            'product_id' => $product->id,
            'type' => $type,
            'qty_delta' => $qtyDelta,
            'qty_after' => $product->stock_qty,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'user_id' => $userId,
            'note' => $note,
        ]);
    }
}
