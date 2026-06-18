<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Sales\Models\Sale;
use App\Modules\Sales\Models\SaleLine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductDestroyTest extends TestCase
{
    use RefreshDatabase;

    private function product(): Product
    {
        return Product::create([
            'name' => 'Rice 5kg',
            'unit' => 'pcs',
            'avg_cost' => 100,
            'sell_price' => 130,
            'stock_qty' => 20,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    public function test_unused_product_is_hard_deleted(): void
    {
        $owner = User::factory()->owner()->create();
        $product = $this->product();

        $this->actingAs($owner)
            ->deleteJson("/api/v1/inventory/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('action', 'deleted');

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    public function test_product_in_sale_is_deactivated_not_deleted(): void
    {
        $owner = User::factory()->owner()->create();
        $product = $this->product();
        $sale = Sale::create([
            'store_id' => null,
            'client_id' => (string) Str::uuid(),
            'invoice_no' => 'INV-1',
            'sold_at' => now(),
            'subtotal' => 130,
            'discount' => 0,
            'total' => 130,
            'cashier_id' => $owner->id,
        ]);
        SaleLine::create([
            'sale_id' => $sale->id,
            'product_id' => $product->id,
            'qty' => 1,
            'unit_price' => 130,
            'line_total' => 130,
            'cost_at_sale' => 100,
        ]);

        $this->actingAs($owner)
            ->deleteJson("/api/v1/inventory/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('action', 'deactivated');

        $this->assertDatabaseHas('products', ['id' => $product->id, 'is_active' => false]);
    }

    public function test_product_with_stock_history_is_deactivated(): void
    {
        $owner = User::factory()->owner()->create();
        $product = $this->product();
        StockMovement::create([
            'store_id' => null,
            'product_id' => $product->id,
            'type' => 'adjustment',
            'qty_delta' => 5,
            'qty_after' => 25,
            'reference_type' => null,
            'reference_id' => null,
        ]);

        $this->actingAs($owner)
            ->deleteJson("/api/v1/inventory/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('action', 'deactivated');

        $this->assertDatabaseHas('products', ['id' => $product->id, 'is_active' => false]);
    }
}
