<?php

namespace App\Modules\Sales\Models;

use App\Modules\Customers\Models\Customer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaleReturn extends Model
{
    protected $fillable = [
        'store_id', 'sale_id', 'customer_id', 'return_no',
        'total', 'refund_method', 'note', 'returned_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'returned_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SaleReturnLine::class);
    }
}
