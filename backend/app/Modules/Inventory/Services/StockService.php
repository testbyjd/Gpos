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
}
