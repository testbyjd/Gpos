<?php

namespace App\Modules\Sync\Services;

use App\Modules\Customers\Models\Customer;
use App\Modules\Inventory\Models\Category;
use App\Modules\Inventory\Models\Product;
use Illuminate\Support\Carbon;

class CatalogPullService
{
    /**
     * @return array{server_time: string, products: mixed, customers: mixed, categories: mixed}
     */
    public function pull(?string $since): array
    {
        $sinceAt = $since ? Carbon::parse($since) : Carbon::createFromTimestamp(0);

        return [
            'server_time' => now()->toIso8601String(),
            'products' => Product::where('updated_at', '>', $sinceAt)
                ->where('is_active', true)
                ->get(['id', 'category_id', 'sku', 'barcode', 'name', 'unit', 'sell_price', 'stock_qty', 'expiry_date', 'updated_at']),
            'customers' => Customer::where('updated_at', '>', $sinceAt)
                ->where('is_active', true)
                ->get(['id', 'code', 'name', 'phone', 'balance', 'updated_at']),
            'categories' => Category::where('updated_at', '>', $sinceAt)
                ->get(['id', 'name', 'updated_at']),
        ];
    }
}
