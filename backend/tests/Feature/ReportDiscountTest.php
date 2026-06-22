<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Sales\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportDiscountTest extends TestCase
{
    use RefreshDatabase;

    public function test_discount_totals_appear_in_reports_summary(): void
    {
        $owner = User::factory()->owner()->create();

        Sale::create([
            'store_id' => null,
            'client_id' => (string) Str::uuid(),
            'invoice_no' => 'INV-1',
            'sold_at' => now(),
            'subtotal' => 1000,
            'discount' => 200,
            'discount_recipient_name' => 'Ahmed',
            'discount_reason' => 'Gift to friend',
            'total' => 800,
            'cashier_id' => $owner->id,
        ]);

        Sale::create([
            'store_id' => null,
            'client_id' => (string) Str::uuid(),
            'invoice_no' => 'INV-2',
            'sold_at' => now(),
            'subtotal' => 500,
            'discount' => 50,
            'total' => 450,
            'cashier_id' => $owner->id,
        ]);

        $today = now()->toDateString();

        $this->actingAs($owner)
            ->getJson("/api/v1/reports/summary?from={$today}&to={$today}")
            ->assertOk()
            ->assertJsonPath('total_discount', 250)
            ->assertJsonPath('discount_count', 2)
            ->assertJsonPath('discounts_by_reason.0.reason', 'Gift to friend')
            ->assertJsonPath('discounts_by_reason.0.amount', 200)
            ->assertJsonPath('discounts_by_reason.1.reason', 'No reason')
            ->assertJsonPath('discounts_by_reason.1.amount', 50);
    }
}
