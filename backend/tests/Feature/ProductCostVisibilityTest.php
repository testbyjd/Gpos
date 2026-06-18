<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Inventory\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCostVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(): void
    {
        Product::create([
            'name' => 'Cooking Oil',
            'unit' => 'ltr',
            'avg_cost' => 420,
            'sell_price' => 480,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    public function test_cashier_does_not_receive_cost_price(): void
    {
        $this->makeProduct();

        $response = $this->actingAs(User::factory()->cashier()->create())
            ->getJson('/api/v1/inventory/products')
            ->assertOk();

        $this->assertArrayNotHasKey('avg_cost', $response->json('data.0'));
        $this->assertEquals(480, $response->json('data.0.sell_price'));
    }

    public function test_owner_receives_cost_price(): void
    {
        $this->makeProduct();

        $response = $this->actingAs(User::factory()->owner()->create())
            ->getJson('/api/v1/inventory/products')
            ->assertOk();

        $this->assertEquals(420, $response->json('data.0.avg_cost'));
    }
}
