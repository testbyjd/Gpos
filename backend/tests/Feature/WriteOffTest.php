<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Inventory\Models\StockWriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WriteOffTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_write_off_stock_and_loss_is_recorded(): void
    {
        $manager = User::factory()->manager()->create();
        $product = Product::create([
            'name' => 'Milk Pack',
            'unit' => 'pcs',
            'avg_cost' => 120,
            'sell_price' => 150,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);

        $response = $this->actingAs($manager)
            ->postJson('/api/v1/inventory/write-offs', [
                'product_id' => $product->id,
                'qty' => 3,
                'reason' => 'expired',
                'note' => 'Batch expired',
            ])
            ->assertCreated();

        $this->assertEquals(360.0, (float) $response->json('data.loss_value'));

        $product->refresh();
        $this->assertEquals(7.000, (float) $product->stock_qty);

        $writeOff = StockWriteOff::firstOrFail();
        $this->assertSame('expired', $writeOff->reason);
        $this->assertEquals(360.00, (float) $writeOff->loss_value);

        $movement = StockMovement::where('type', 'write_off')->firstOrFail();
        $this->assertEquals(-3.000, (float) $movement->qty_delta);
    }

    public function test_cashier_cannot_write_off_stock(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Bread',
            'unit' => 'pcs',
            'avg_cost' => 80,
            'sell_price' => 100,
            'stock_qty' => 5,
            'low_stock_threshold' => 1,
            'is_active' => true,
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/inventory/write-offs', [
                'product_id' => $product->id,
                'qty' => 1,
                'reason' => 'gift_sample',
            ])
            ->assertForbidden();
    }

    public function test_write_off_loss_appears_in_reports(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::create([
            'name' => 'Juice',
            'unit' => 'pcs',
            'avg_cost' => 50,
            'sell_price' => 70,
            'stock_qty' => 4,
            'low_stock_threshold' => 1,
            'is_active' => true,
        ]);

        $this->actingAs($owner)
            ->postJson('/api/v1/inventory/write-offs', [
                'product_id' => $product->id,
                'qty' => 2,
                'reason' => 'gift_sample',
            ])
            ->assertCreated();

        $today = now()->toDateString();
        $this->actingAs($owner)
            ->getJson("/api/v1/reports/summary?from={$today}&to={$today}")
            ->assertOk()
            ->assertJsonPath('total_write_off_loss', 100)
            ->assertJsonPath('write_offs_by_reason.0.reason', 'gift_sample');
    }
}
