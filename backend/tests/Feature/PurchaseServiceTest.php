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

        app(PurchaseService::class)->create([
            'vendor_id' => $vendor->id,
            'lines' => [
                ['name' => 'Daal Chana', 'unit' => 'kg', 'qty' => 25, 'unit_cost' => 180, 'sell_price' => 220],
            ],
        ]);

        $product = Product::where('name', 'Daal Chana')->firstOrFail();

        $this->assertEquals(180.00, (float) $product->avg_cost);
        $this->assertEquals(25.000, (float) $product->stock_qty);
        $this->assertEquals(220.00, (float) $product->sell_price);
    }
}
