<?php

namespace App\Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    protected $fillable = [
        'store_id', 'product_id', 'type', 'qty_delta', 'qty_after',
        'reference_type', 'reference_id', 'user_id', 'note',
    ];

    protected function casts(): array
    {
        return [
            'qty_delta' => 'decimal:3',
            'qty_after' => 'decimal:3',
        ];
    }
}
