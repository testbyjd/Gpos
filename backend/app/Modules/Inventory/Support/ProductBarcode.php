<?php

namespace App\Modules\Inventory\Support;

use Illuminate\Database\Eloquent\Builder;

class ProductBarcode
{
    public static function normalize(?string $barcode): ?string
    {
        if ($barcode === null) {
            return null;
        }

        $trimmed = trim($barcode);

        return $trimmed !== '' ? $trimmed : null;
    }

    /** Case-insensitive exact match on trimmed barcode. */
    public static function applyMatch(Builder $query, ?string $barcode): Builder
    {
        $normalized = self::normalize($barcode);
        if ($normalized === null) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereRaw('LOWER(TRIM(barcode)) = ?', [strtolower($normalized)]);
    }
}
