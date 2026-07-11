<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Sales\Models\TillSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TillTest extends TestCase
{
    use RefreshDatabase;

    public function test_current_opens_a_session_when_none_exists(): void
    {
        $this->actingAs(User::factory()->cashier()->create())
            ->getJson('/api/v1/till/current')
            ->assertOk()
            ->assertJsonPath('data.register_name', 'POS Register #1');

        $this->assertEquals(1, TillSession::count());
    }

    public function test_cashier_gets_blind_count_summary_without_expected_cash(): void
    {
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs(User::factory()->cashier()->create())
            ->getJson('/api/v1/till/current')
            ->assertOk();

        // Blind count: cashier can see non-cash totals + sales count, but
        // nothing that reveals the expected cash figure.
        $data = $response->json('data');
        $this->assertArrayNotHasKey('expected_cash', $data);
        $this->assertArrayNotHasKey('cash_sales', $data);
        $this->assertArrayNotHasKey('opening_float', $data);
        $this->assertArrayHasKey('card_total', $data);
        $this->assertArrayHasKey('sales_count', $data);
        $this->assertArrayHasKey('payment_breakdown', $data);
        $methods = collect($data['payment_breakdown'])->pluck('method');
        $this->assertFalse($methods->contains('cash'));
        $this->assertTrue($methods->contains('card'));
        $this->assertTrue($methods->contains('easypaisa'));
        $this->assertTrue($methods->contains('khata'));
    }

    public function test_manager_sees_full_till_summary(): void
    {
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs(User::factory()->manager()->create())
            ->getJson('/api/v1/till/current')
            ->assertOk();

        $data = $response->json('data');
        $this->assertArrayHasKey('expected_cash', $data);
        $this->assertArrayHasKey('cash_sales', $data);
        $this->assertArrayHasKey('opening_float', $data);
        $this->assertArrayHasKey('payment_breakdown', $data);
        $methods = collect($data['payment_breakdown'])->pluck('method');
        $this->assertTrue($methods->contains('cash'));
        $this->assertTrue($methods->contains('easypaisa'));
        $this->assertTrue($methods->contains('jazzcash'));
        $this->assertTrue($methods->contains('bank_transfer'));
    }

    public function test_close_computes_variance(): void
    {
        $manager = User::factory()->manager()->create();
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(4),
        ]);

        // No cash sales -> expected_cash = opening float 1000.
        // Counted 1200 -> variance +200, retain 1000 float -> hand over 200.
        $this->actingAs($manager)
            ->postJson('/api/v1/till/close', [
                'counted_cash' => 1200,
                'retained_float' => 1000,
            ])
            ->assertOk()
            ->assertJsonPath('data.variance', '200.00')
            ->assertJsonPath('data.handed_over', '200.00')
            ->assertJsonPath('data.expected_cash', '1000.00');
    }

    public function test_close_rejects_retained_float_above_counted_cash(): void
    {
        $manager = User::factory()->manager()->create();
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(1),
        ]);

        $this->actingAs($manager)
            ->postJson('/api/v1/till/close', [
                'counted_cash' => 500,
                'retained_float' => 1000,
            ])
            ->assertStatus(422);
    }

    public function test_close_rejects_when_non_cash_not_confirmed(): void
    {
        $manager = User::factory()->manager()->create();
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(1),
        ]);

        $product = \App\Modules\Inventory\Models\Product::create([
            'name' => 'Milk', 'unit' => 'pcs', 'avg_cost' => 40,
            'sell_price' => 80, 'stock_qty' => 20, 'low_stock_threshold' => 2, 'is_active' => true,
        ]);

        $this->actingAs($manager)->postJson('/api/v1/sync/push', [
            'device_id' => 'register-1',
            'sales' => [[
                'client_id' => (string) \Illuminate\Support\Str::uuid(),
                'sold_at' => now()->toIso8601String(),
                'subtotal' => 80,
                'discount' => 0,
                'total' => 80,
                'lines' => [[
                    'product_id' => $product->id,
                    'qty' => 1,
                    'unit_price' => 80,
                    'line_total' => 80,
                ]],
                'payments' => [[
                    'method' => 'easypaisa',
                    'amount' => 80,
                    'reference_id' => 'EP-1',
                ]],
            ]],
        ])->assertOk();

        $this->actingAs($manager)
            ->postJson('/api/v1/till/close', [
                'counted_cash' => 1000,
                'retained_float' => 1000,
            ])
            ->assertStatus(422);
    }

    public function test_close_accepts_confirmed_non_cash_settlement(): void
    {
        $manager = User::factory()->manager()->create();
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(1),
        ]);

        $product = \App\Modules\Inventory\Models\Product::create([
            'name' => 'Bread', 'unit' => 'pcs', 'avg_cost' => 40,
            'sell_price' => 80, 'stock_qty' => 20, 'low_stock_threshold' => 2, 'is_active' => true,
        ]);

        $this->actingAs($manager)->postJson('/api/v1/sync/push', [
            'device_id' => 'register-1',
            'sales' => [[
                'client_id' => (string) \Illuminate\Support\Str::uuid(),
                'sold_at' => now()->toIso8601String(),
                'subtotal' => 80,
                'discount' => 0,
                'total' => 80,
                'lines' => [[
                    'product_id' => $product->id,
                    'qty' => 1,
                    'unit_price' => 80,
                    'line_total' => 80,
                ]],
                'payments' => [[
                    'method' => 'card',
                    'amount' => 80,
                    'reference_id' => 'CARD-1',
                ]],
            ]],
        ])->assertOk();

        $this->actingAs($manager)
            ->postJson('/api/v1/till/close', [
                'counted_cash' => 1000,
                'retained_float' => 1000,
                'payment_settlements' => [[
                    'method' => 'card',
                    'expected' => 80,
                    'settled' => 80,
                    'confirmed' => true,
                ]],
            ])
            ->assertOk();
    }

    public function test_cashier_cannot_close_till(): void
    {
        $cashier = User::factory()->cashier()->create();
        TillSession::create([
            'register_name' => 'POS Register #1',
            'opening_float' => 1000,
            'opened_at' => now()->subHours(1),
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/till/close', [
                'counted_cash' => 1000,
                'retained_float' => 1000,
            ])
            ->assertStatus(403);
    }
}
