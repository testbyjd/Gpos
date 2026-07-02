<?php

namespace App\Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Modules\Inventory\Support\ProductBarcode;

class Product extends Model
{
    protected $fillable = [
        'store_id', 'category_id', 'sku', 'barcode', 'name', 'brand', 'image_path',
        'unit', 'unit_precision', 'avg_cost', 'sell_price', 'stock_qty',
        'low_stock_threshold', 'expiry_date', 'is_active',
    ];

    protected static function booted(): void
    {
        static::saving(function (Product $product) {
            if ($product->isDirty('barcode')) {
                $product->barcode = ProductBarcode::normalize($product->barcode);
            }
            if ($product->isDirty('sku')) {
                $sku = trim((string) ($product->sku ?? ''));
                $product->sku = $sku !== '' ? $sku : null;
            }
        });
    }

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return '/storage/'.$this->image_path;
    }

    public function deleteStoredImage(): void
    {
        if ($this->image_path) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($this->image_path);
        }
    }

    protected function casts(): array
    {
        return [
            'avg_cost' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'stock_qty' => 'decimal:3',
            'low_stock_threshold' => 'decimal:3',
            'expiry_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** True when sales, purchases, or stock history reference this SKU. */
    public function isInUse(): bool
    {
        return \DB::table('sale_lines')->where('product_id', $this->id)->exists()
            || \DB::table('purchase_lines')->where('product_id', $this->id)->exists()
            || \DB::table('stock_movements')->where('product_id', $this->id)->exists();
    }
}
