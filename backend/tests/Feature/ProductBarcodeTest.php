<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Inventory\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductBarcodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_product_with_manual_barcode(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->postJson('/api/v1/inventory/products', [
                'name' => 'Tea Pack',
                'barcode' => '8964000999888',
                'unit' => 'pack',
                'sell_price' => 250,
            ])
            ->assertCreated()
            ->assertJsonPath('data.barcode', '8964000999888');

        $this->assertDatabaseHas('products', ['name' => 'Tea Pack', 'barcode' => '8964000999888']);
    }

    public function test_owner_can_update_product_barcode(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::create([
            'name' => 'Sugar 1kg',
            'unit' => 'kg',
            'sell_price' => 120,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);

        $this->actingAs($owner)
            ->patchJson("/api/v1/inventory/products/{$product->id}", [
                'barcode' => '8964000111222',
            ])
            ->assertOk()
            ->assertJsonPath('data.barcode', '8964000111222');
    }
}
