<?php

namespace App\Modules\Customers\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerLedgerEntry extends Model
{
    protected $fillable = [
        'customer_id', 'type', 'amount', 'balance_after',
        'reference_type', 'reference_id', 'note', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
        ];
    }
}
