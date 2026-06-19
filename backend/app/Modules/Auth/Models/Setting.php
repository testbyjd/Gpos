<?php

namespace App\Modules\Auth\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    /** @return array<string, mixed> */
    public static function get(string $key, array $default = []): array
    {
        $row = static::where('key', $key)->first();

        return is_array($row?->value) ? array_merge($default, $row->value) : $default;
    }

    /** @param array<string, mixed> $value */
    public static function put(string $key, array $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
