<?php

namespace App\Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $canSeeCost = $user && in_array($user->role, ['owner', 'manager'], true);

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category' => $this->category?->name,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'brand' => $this->brand,
            'image_url' => $this->image_url,
            'unit' => $this->unit,
            'unit_precision' => $this->unit_precision,
            'fractional' => $this->unit_precision > 0,
            // Cost price is hidden from cashiers (plan §4.5).
            $this->mergeWhen($canSeeCost, fn () => ['avg_cost' => (float) $this->avg_cost]),
            'sell_price' => (float) $this->sell_price,
            'price' => (float) $this->sell_price,
            'stock_qty' => (float) $this->stock_qty,
            'stock' => (float) $this->stock_qty,
            'low_stock_threshold' => (float) $this->low_stock_threshold,
            'expiry_date' => $this->expiry_date?->toDateString(),
            'is_active' => (bool) $this->is_active,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
