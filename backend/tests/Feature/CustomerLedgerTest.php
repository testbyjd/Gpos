<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Customers\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_repayment_reduces_customer_balance_and_logs_entry(): void
    {
        $manager = User::factory()->manager()->create();
        $customer = Customer::create(['name' => 'Bilal', 'balance' => 500, 'is_active' => true]);

        $this->actingAs($manager)
            ->postJson("/api/v1/customers/{$customer->id}/repayments", [
                'amount' => 200,
                'note' => 'Weekly installment',
            ])
            ->assertOk()
            ->assertJsonPath('customer.balance', '300.00')
            ->assertJsonPath('data.type', 'repayment');

        $customer->refresh();
        $this->assertEquals(300.00, (float) $customer->balance);
    }

    public function test_ledger_lists_entries_for_customer(): void
    {
        $manager = User::factory()->manager()->create();
        $customer = Customer::create(['name' => 'Sana', 'balance' => 0, 'is_active' => true]);

        $this->actingAs($manager)
            ->getJson("/api/v1/customers/{$customer->id}/ledger")
            ->assertOk()
            ->assertJsonPath('customer.id', $customer->id);
    }

    public function test_cashier_cannot_view_ledger_or_post_repayment(): void
    {
        $cashier = User::factory()->cashier()->create();
        $customer = Customer::create(['name' => 'Sana', 'balance' => 0, 'is_active' => true]);

        $this->actingAs($cashier)
            ->getJson("/api/v1/customers/{$customer->id}/ledger")
            ->assertStatus(403);

        $this->actingAs($cashier)
            ->postJson("/api/v1/customers/{$customer->id}/repayments", ['amount' => 100])
            ->assertStatus(403);
    }
}
