<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Inventory\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductImageTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_upload_and_delete_product_image(): void
    {
        Storage::fake('public');

        $manager = User::factory()->manager()->create();
        $product = Product::create([
            'name' => 'Biscuit',
            'unit' => 'pcs',
            'avg_cost' => 30,
            'sell_price' => 50,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);

        $response = $this->actingAs($manager)
            ->post('/api/v1/inventory/products/'.$product->id.'/image', [
                'image' => UploadedFile::fake()->create('biscuit.jpg', 100, 'image/jpeg'),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertStringStartsWith(
            '/storage/products/',
            (string) $response->json('data.image_url'),
        );

        $product->refresh();
        $this->assertNotNull($product->image_path);
        Storage::disk('public')->assertExists($product->image_path);

        $this->actingAs($manager)
            ->delete('/api/v1/inventory/products/'.$product->id.'/image', [], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.image_url', null);

        $product->refresh();
        $this->assertNull($product->image_path);
    }

    public function test_cashier_cannot_upload_product_image(): void
    {
        Storage::fake('public');

        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Tea',
            'unit' => 'pcs',
            'avg_cost' => 30,
            'sell_price' => 50,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);

        $this->actingAs($cashier)
            ->post('/api/v1/inventory/products/'.$product->id.'/image', [
                'image' => UploadedFile::fake()->create('tea.jpg', 100, 'image/jpeg'),
            ], ['Accept' => 'application/json'])
            ->assertForbidden();
    }
}
