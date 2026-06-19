<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_record_vendor_payment(): void
    {
        $owner = User::factory()->owner()->create();
        $vendor = Vendor::create(['name' => 'Nestle', 'balance' => 500]);
        $purchase = Purchase::create([
            'vendor_id' => $vendor->id,
            'grn_no' => 'GRN-1',
            'subtotal' => 500,
            'paid_amount' => 0,
            'balance_amount' => 500,
            'received_at' => now(),
        ]);

        $this->actingAs($owner)
            ->postJson('/api/v1/payables/payments', [
                'purchase_id' => $purchase->id,
                'amount' => 200,
            ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $purchase->refresh();
        $vendor->refresh();
        $this->assertEquals(200, (float) $purchase->paid_amount);
        $this->assertEquals(300, (float) $purchase->balance_amount);
        $this->assertEquals(300, (float) $vendor->balance);
    }
}
