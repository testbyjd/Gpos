<?php

namespace App\Modules\Vendors\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    protected $fillable = [
        'client_id', 'store_id', 'vendor_id', 'grn_no', 'payment_terms', 'receiving_status', 'subtotal',
        'paid_amount', 'balance_amount', 'received_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance_amount' => 'decimal:2',
            'received_at' => 'datetime',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseLine::class);
    }
}
