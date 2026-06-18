<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Customers\Models\Customer;
use App\Modules\Inventory\Models\Product;
use App\Modules\Sales\Models\Sale;
use App\Modules\Sales\Models\SaleLine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SaleSyncTest extends TestCase
{
    use RefreshDatabase;

    private function salePayload(string $clientId, Product $product, ?Customer $customer = null, string $method = 'cash'): array
    {
        return [
            'device_id' => 'register-1',
            'sales' => [[
                'client_id' => $clientId,
                'sold_at' => now()->toIso8601String(),
                'subtotal' => 100,
                'discount' => 0,
                'total' => 100,
                'customer_id' => $customer?->id,
                'lines' => [[
                    'product_id' => $product->id,
                    'qty' => 2,
                    'unit_price' => 50,
                    'line_total' => 100,
                ]],
                'payments' => [[
                    'method' => $method,
                    'amount' => 100,
                ]],
            ]],
        ];
    }

    public function test_sync_push_creates_sale_and_deducts_stock(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Biscuit', 'unit' => 'pcs', 'avg_cost' => 30,
            'sell_price' => 50, 'stock_qty' => 10, 'low_stock_threshold' => 2, 'is_active' => true,
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/sync/push', $this->salePayload(Str::uuid()->toString(), $product))
            ->assertOk()
            ->assertJsonPath('results.0.status', 'created');

        $product->refresh();
        $this->assertEquals(8.000, (float) $product->stock_qty);

        $sale = Sale::firstOrFail();
        $this->assertEquals('INV-'.$sale->id, $sale->invoice_no);
        // cost snapshot captured for P&L
        $this->assertEquals(30.00, (float) SaleLine::first()->cost_at_sale);
    }

    public function test_sync_push_is_idempotent_on_duplicate_client_id(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Soap', 'unit' => 'pcs', 'avg_cost' => 30,
            'sell_price' => 50, 'stock_qty' => 10, 'low_stock_threshold' => 2, 'is_active' => true,
        ]);
        $clientId = Str::uuid()->toString();
        $payload = $this->salePayload($clientId, $product);

        $this->actingAs($cashier)->postJson('/api/v1/sync/push', $payload)->assertOk();
        $this->actingAs($cashier)->postJson('/api/v1/sync/push', $payload)
            ->assertOk()
            ->assertJsonPath('results.0.status', 'already_synced');

        $this->assertEquals(1, Sale::count());
        $product->refresh();
        // stock deducted only once
        $this->assertEquals(8.000, (float) $product->stock_qty);
    }

    public function test_khata_sale_increases_customer_balance(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Tea', 'unit' => 'pcs', 'avg_cost' => 30,
            'sell_price' => 50, 'stock_qty' => 10, 'low_stock_threshold' => 2, 'is_active' => true,
        ]);
        $customer = Customer::create(['name' => 'Ahmed', 'balance' => 0, 'is_active' => true]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/sync/push', $this->salePayload(Str::uuid()->toString(), $product, $customer, 'khata'))
            ->assertOk();

        $customer->refresh();
        $this->assertEquals(100.00, (float) $customer->balance);
    }

    public function test_sync_rejects_oversell_and_does_not_persist(): void
    {
        $cashier = User::factory()->cashier()->create();
        $product = Product::create([
            'name' => 'Eggs', 'unit' => 'pcs', 'avg_cost' => 30,
            'sell_price' => 50, 'stock_qty' => 1, 'low_stock_threshold' => 2, 'is_active' => true,
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/sync/push', $this->salePayload(Str::uuid()->toString(), $product))
            ->assertStatus(409);

        $this->assertEquals(0, Sale::count());
        $product->refresh();
        $this->assertEquals(1.000, (float) $product->stock_qty);
    }
}
