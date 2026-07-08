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

    public function test_cashier_can_heal_legacy_truncated_barcode(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Lux Soap',
            'barcode' => '1014258348',
            'unit' => 'pcs',
            'sell_price' => 160,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/v1/inventory/products/{$product->id}/heal-barcode", [
                'barcode' => '8961014258348',
            ])
            ->assertOk()
            ->assertJsonPath('data.barcode', '8961014258348');

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'barcode' => '8961014258348',
        ]);
    }

    public function test_heal_barcode_rejects_non_legacy_mismatch(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Lux Soap',
            'barcode' => '9999999999',
            'unit' => 'pcs',
            'sell_price' => 160,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/v1/inventory/products/{$product->id}/heal-barcode", [
                'barcode' => '8961014258348',
            ])
            ->assertStatus(422);
    }
}
