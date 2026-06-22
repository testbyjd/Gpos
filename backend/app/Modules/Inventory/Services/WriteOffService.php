<?php

namespace App\Modules\Inventory\Services;

use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockWriteOff;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WriteOffService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * @param  array{product_id: int, qty: float, reason: string, note?: string|null, store_id?: int|null}  $data
     */
    public function create(array $data, ?int $userId = null): StockWriteOff
    {
        return DB::transaction(function () use ($data, $userId) {
            $product = Product::lockForUpdate()->findOrFail($data['product_id']);
            $qty = (float) $data['qty'];

            if ($qty <= 0) {
                throw ValidationException::withMessages(['qty' => ['Qty 0 se zyada honi chahiye.']]);
            }

            if ((float) $product->stock_qty < $qty) {
                throw ValidationException::withMessages([
                    'qty' => ["Stock kam hai — ab sirf {$product->stock_qty} {$product->unit} available."],
                ]);
            }

            $unitCost = (float) $product->avg_cost;
            $lossValue = round($qty * $unitCost, 2);

            $writeOff = StockWriteOff::create([
                'store_id' => $data['store_id'] ?? $product->store_id,
                'product_id' => $product->id,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'loss_value' => $lossValue,
                'reason' => $data['reason'],
                'note' => $data['note'] ?? null,
                'created_by' => $userId,
            ]);

            $this->stock->record(
                $product->id,
                -$qty,
                'write_off',
                'write_off',
                $writeOff->id,
                $userId,
                trim(($data['note'] ?? '').' ['.$data['reason'].']') ?: $data['reason'],
            );

            return $writeOff->load(['product', 'creator:id,name']);
        });
    }
}
