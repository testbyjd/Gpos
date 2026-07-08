<?php

namespace App\Modules\Inventory\Support;

use Illuminate\Database\Eloquent\Builder;

class ProductBarcode
{
    /** Old handheld scanner custom rule: first N digits stripped. */
    public const LEGACY_PREFIX_SKIP = 3;

    public const MIN_TRUNCATED_LEN = 8;

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

    /**
     * True when $stored looks like the old scanner output for $full
     * (first LEGACY_PREFIX_SKIP chars removed).
     */
    public static function isLegacyTruncation(?string $stored, ?string $full): bool
    {
        $storedNorm = self::normalize($stored);
        $fullNorm = self::normalize($full);
        if ($storedNorm === null || $fullNorm === null) {
            return false;
        }

        if (strlen($fullNorm) <= self::LEGACY_PREFIX_SKIP + self::MIN_TRUNCATED_LEN - 1) {
            return false;
        }

        $expected = substr($fullNorm, self::LEGACY_PREFIX_SKIP);
        if (strlen($expected) < self::MIN_TRUNCATED_LEN) {
            return false;
        }

        return strtolower($storedNorm) === strtolower($expected);
    }
}
