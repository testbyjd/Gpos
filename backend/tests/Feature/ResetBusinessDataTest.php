<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Customers\Models\Customer;
use App\Modules\Inventory\Models\Category;
use App\Modules\Inventory\Models\Product;
use App\Modules\Sales\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ResetBusinessDataTest extends TestCase
{
    use RefreshDatabase;

    private function createStoreUser(): User
    {
        $storeId = DB::table('stores')->insertGetId([
            'name' => 'Test Store',
            'phone' => '0300-0000000',
            'timezone' => 'Asia/Karachi',
            'currency' => 'PKR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::factory()->owner()->create(['store_id' => $storeId]);
    }

    public function test_reset_keeps_users_and_wipes_business_data(): void
    {
        $user = $this->createStoreUser();
        Customer::query()->create([
            'store_id' => $user->store_id,
            'name' => 'Ali',
            'phone' => '03001234567',
            'balance' => 100,
            'is_active' => true,
        ]);
        Product::query()->create([
            'store_id' => $user->store_id,
            'name' => 'Test Item',
            'unit' => 'pcs',
            'avg_cost' => 40,
            'sell_price' => 50,
            'stock_qty' => 10,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
        Sale::query()->create([
            'store_id' => $user->store_id,
            'invoice_no' => 'INV-1',
            'cashier_id' => $user->id,
            'subtotal' => 100,
            'discount' => 0,
            'total' => 100,
            'sold_at' => now(),
        ]);

        $this->artisan('gpos:reset-data --force')
            ->assertSuccessful();

        $this->assertSame(1, User::query()->count());
        $this->assertSame(0, Customer::query()->count());
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, Sale::query()->count());
    }

    public function test_reset_can_seed_default_categories(): void
    {
        $user = $this->createStoreUser();

        $this->artisan('gpos:reset-data --force --with-categories')
            ->assertSuccessful();

        $this->assertSame(10, Category::query()->where('store_id', $user->store_id)->count());
    }
}
