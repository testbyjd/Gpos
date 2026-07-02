<?php

use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Support\ProductBarcode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private array $productFkTables = [
        'purchase_lines',
        'sale_lines',
        'stock_movements',
        'stock_write_offs',
        'purchase_return_lines',
        'sale_return_lines',
    ];

    public function up(): void
    {
        Product::query()->whereNotNull('barcode')->orderBy('id')->each(function (Product $product) {
            $normalized = ProductBarcode::normalize($product->barcode);
            if ($normalized !== $product->barcode) {
                $product->update(['barcode' => $normalized]);
            }
        });

        $groups = Product::query()
            ->whereNotNull('barcode')
            ->where('barcode', '!=', '')
            ->orderBy('id')
            ->get()
            ->groupBy(fn (Product $product) => strtolower($product->barcode));

        foreach ($groups as $group) {
            if ($group->count() < 2) {
                continue;
            }

            $canonical = $this->pickCanonical($group);
            foreach ($group as $product) {
                if ($product->id === $canonical->id) {
                    continue;
                }
                $this->mergeInto($product, $canonical);
                $canonical->refresh();
            }
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement(
                "CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products (barcode) WHERE barcode IS NOT NULL AND barcode <> ''"
            );
        } else {
            Schema::table('products', function (Blueprint $table) {
                $table->unique('barcode');
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS products_barcode_unique');
        } elseif (Schema::hasColumn('products', 'barcode')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropUnique(['barcode']);
            });
        }
    }

    /** @param  \Illuminate\Support\Collection<int, Product>  $group */
    private function pickCanonical($group): Product
    {
        return $group->sort(function (Product $a, Product $b) {
            if ($a->sku && ! $b->sku) {
                return -1;
            }
            if (! $a->sku && $b->sku) {
                return 1;
            }

            $stockCmp = (float) $b->stock_qty <=> (float) $a->stock_qty;
            if ($stockCmp !== 0) {
                return $stockCmp;
            }

            return $a->id <=> $b->id;
        })->first();
    }

    private function mergeInto(Product $from, Product $into): void
    {
        DB::transaction(function () use ($from, $into) {
            $fromStock = (float) $from->stock_qty;
            $intoStock = (float) $into->stock_qty;
            $totalStock = $fromStock + $intoStock;

            if ($totalStock > 0) {
                $into->avg_cost = round(
                    (($fromStock * (float) $from->avg_cost) + ($intoStock * (float) $into->avg_cost)) / $totalStock,
                    2,
                );
            }

            $into->stock_qty = round($totalStock, 3);

            if (! $into->sku && $from->sku) {
                $into->sku = $from->sku;
            }
            if (! $into->image_path && $from->image_path) {
                $into->image_path = $from->image_path;
            }
            if (! $into->category_id && $from->category_id) {
                $into->category_id = $from->category_id;
            }
            if (! $into->expiry_date && $from->expiry_date) {
                $into->expiry_date = $from->expiry_date;
            }

            $into->save();

            foreach ($this->productFkTables as $table) {
                DB::table($table)->where('product_id', $from->id)->update(['product_id' => $into->id]);
            }

            $from->deleteStoredImage();
            $from->delete();
        });
    }
};
