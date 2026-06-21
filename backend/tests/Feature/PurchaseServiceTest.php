<?php

namespace Tests\Feature;

use App\Modules\Inventory\Models\Product;
use App\Modules\Vendors\Models\Vendor;
use App\Modules\Vendors\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_create_is_idempotent_on_client_id(): void
    {
        $vendor = Vendor::create(['name' => 'Rice Mill', 'balance' => 0, 'is_active' => true]);
        $product = Product::create([
            'name' => 'Basmati Rice',
            'unit' => 'kg',
            'avg_cost' => 200,
            'sell_price' => 260,
            'stock_qty' => 10,
            'low_stock_threshold' => 5,
            'is_active' => true,
        ]);

        $clientId = '550e8400-e29b-41d4-a716-446655440000';
        $payload = [
            'client_id' => $clientId,
            'vendor_id' => $vendor->id,
            'lines' => [
                ['product_id' => $product->id, 'qty' => 5, 'unit_cost' => 210],
            ],
        ];

        $service = app(PurchaseService::class);
        $first = $service->create($payload);
        $second = $service->create($payload);

        $this->assertEquals($first->id, $second->id);
        $this->assertEquals(1, \App\Modules\Vendors\Models\Purchase::count());
        $this->assertEquals($clientId, $first->client_id);
    }

    public function test_goods_receipt_recalculates_moving_average_cost(): void
    {
        $product = Product::create([
            'name' => 'Basmati Rice',
            'unit' => 'kg',
            'avg_cost' => 200,
            'sell_price' => 260,
            'stock_qty' => 10, // 10kg @ 200 = 2000
            'low_stock_threshold' => 5,
            'is_active' => true,
        ]);
        $vendor = Vendor::create(['name' => 'Rice Mill', 'balance' => 0, 'is_active' => true]);

        // Receive 30kg @ 240. new_avg = (10*200 + 30*240) / 40 = 9200/40 = 230
        app(PurchaseService::class)->create([
            'vendor_id' => $vendor->id,
            'paid_amount' => 5000,
            'lines' => [
                ['product_id' => $product->id, 'qty' => 30, 'unit_cost' => 240],
            ],
        ]);

        $product->refresh();
        $vendor->refresh();

        $this->assertEquals(230.00, (float) $product->avg_cost);
        $this->assertEquals(40.000, (float) $product->stock_qty);
        // subtotal 30*240 = 7200, paid 5000 -> balance 2200 owed to vendor
        $this->assertEquals(2200.00, (float) $vendor->balance);
    }

    public function test_purchase_can_create_new_product_on_the_fly(): void
    {
        $vendor = Vendor::create(['name' => 'New Supplier', 'balance' => 0, 'is_active' => true]);
        $category = \App\Modules\Inventory\Models\Category::create(['name' => 'Pulses']);

        app(PurchaseService::class)->create([
            'vendor_id' => $vendor->id,
            'lines' => [
                [
                    'name' => 'Daal Chana',
                    'category_id' => $category->id,
                    'unit' => 'kg',
                    'qty' => 25,
                    'unit_cost' => 180,
                    'sell_price' => 220,
                ],
            ],
        ]);

        $product = Product::where('name', 'Daal Chana')->firstOrFail();

        $this->assertEquals($category->id, $product->category_id);
        $this->assertEquals(180.00, (float) $product->avg_cost);
        $this->assertEquals(25.000, (float) $product->stock_qty);
        $this->assertEquals(220.00, (float) $product->sell_price);
    }

    public function test_open_grn_can_receive_more_lines_later(): void
    {
        $vendor = Vendor::create(['name' => 'Wholesale', 'balance' => 0, 'is_active' => true]);
        $product = Product::create([
            'name' => 'Oil Tin',
            'unit' => 'pcs',
            'avg_cost' => 100,
            'sell_price' => 130,
            'stock_qty' => 0,
            'low_stock_threshold' => 5,
            'is_active' => true,
        ]);

        $service = app(PurchaseService::class);
        $purchase = $service->create([
            'vendor_id' => $vendor->id,
            'receiving_open' => true,
            'lines' => [
                ['product_id' => $product->id, 'qty' => 100, 'unit_cost' => 110],
            ],
        ]);

        $this->assertSame('open', $purchase->receiving_status);
        $this->assertEquals(100.000, (float) $product->fresh()->stock_qty);

        $updated = $service->appendLines($purchase, [
            ['product_id' => $product->id, 'qty' => 150, 'unit_cost' => 112],
        ]);

        $this->assertEquals(250.000, (float) $product->fresh()->stock_qty);
        $this->assertEquals(27800.00, (float) $updated->subtotal); // 100*110 + 150*112
        $this->assertCount(2, $updated->lines);
    }

    public function test_closed_grn_cannot_append_without_reopen(): void
    {
        $vendor = Vendor::create(['name' => 'Wholesale', 'balance' => 0, 'is_active' => true]);
        $product = Product::create([
            'name' => 'Oil Tin',
            'unit' => 'pcs',
            'avg_cost' => 100,
            'sell_price' => 130,
            'stock_qty' => 0,
            'low_stock_threshold' => 5,
            'is_active' => true,
        ]);

        $service = app(PurchaseService::class);
        $purchase = $service->create([
            'vendor_id' => $vendor->id,
            'lines' => [
                ['product_id' => $product->id, 'qty' => 10, 'unit_cost' => 110],
            ],
        ]);

        $this->assertSame('closed', $purchase->receiving_status);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->appendLines($purchase, [
            ['product_id' => $product->id, 'qty' => 5, 'unit_cost' => 110],
        ]);
    }
}
