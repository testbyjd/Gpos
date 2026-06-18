<?php

namespace App\Modules\Vendors\Models;

use App\Modules\Inventory\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseLine extends Model
{
    protected $fillable = [
        'purchase_id', 'product_id', 'qty', 'unit_cost', 'line_total',
        'old_avg_cost', 'new_avg_cost', 'expiry_date', 'promotion',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
            'unit_cost' => 'decimal:2',
            'line_total' => 'decimal:2',
            'old_avg_cost' => 'decimal:2',
            'new_avg_cost' => 'decimal:2',
            'expiry_date' => 'date',
            'promotion' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
