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
