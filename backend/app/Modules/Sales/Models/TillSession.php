<?php

namespace App\Modules\Sales\Models;

use Illuminate\Database\Eloquent\Model;

class TillSession extends Model
{
    protected $fillable = [
        'store_id', 'register_name', 'opened_by', 'closed_by', 'opening_float',
        'expected_cash', 'counted_cash', 'retained_float', 'handed_over',
        'variance', 'denominations', 'payment_totals', 'notes', 'opened_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'opening_float' => 'decimal:2',
            'expected_cash' => 'decimal:2',
            'counted_cash' => 'decimal:2',
            'retained_float' => 'decimal:2',
            'handed_over' => 'decimal:2',
            'variance' => 'decimal:2',
            'denominations' => 'array',
            'payment_totals' => 'array',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
