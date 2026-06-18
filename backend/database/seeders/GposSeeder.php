<?php

namespace Database\Seeders;

use App\Modules\Customers\Models\Customer;
use App\Modules\Inventory\Models\Category;
use App\Modules\Inventory\Models\Product;
use App\Modules\Vendors\Models\Vendor;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class GposSeeder extends Seeder
{
    public function run(): void
    {
        $storeId = \DB::table('stores')->insertGetId([
            'name' => 'Gondal Traders',
            'phone' => '0300-0000000',
            'timezone' => 'Asia/Karachi',
            'currency' => 'PKR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $users = [
            [
                'name' => 'Shahbaz Gondal',
                'email' => 'shahbaz@gondal.local',
                'password' => 'Shahbaz27',
                'role' => 'manager',
            ],
            [
                'name' => 'Sajjad Gondal',
                'email' => 'sajjad@gondal.local',
                'password' => 'Sajjad64',
                'role' => 'manager',
            ],
            [
                'name' => 'Shehzad Gondal',
                'email' => 'gondaljpj@gmail.com',
                'password' => 'Shehzad91',
                'role' => 'owner',
            ],
            [
                'name' => 'Cashier 1',
                'email' => 'casher1@gondal.com',
                'password' => 'Cashier38',
                'role' => 'cashier',
            ],
            [
                'name' => 'Cashier 2',
                'email' => 'cahser2@gondal.com',
                'password' => 'Cashier52',
                'role' => 'cashier',
            ],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'password' => Hash::make($user['password']),
                    'pin_hash' => Hash::make('1234'),
                    'store_id' => $storeId,
                    'role' => $user['role'],
                    'is_active' => true,
                ],
            );
        }

        $cat = Category::create(['store_id' => $storeId, 'name' => 'Cooking']);
        $dairy = Category::create(['store_id' => $storeId, 'name' => 'Dairy']);

        Product::create([
            'store_id' => $storeId,
            'category_id' => $cat->id,
            'barcode' => '8964000123456',
            'name' => 'Cooking Oil 1L',
            'unit' => 'litre',
            'avg_cost' => 470,
            'sell_price' => 590,
            'stock_qty' => 120,
            'low_stock_threshold' => 20,
        ]);

        Product::create([
            'store_id' => $storeId,
            'category_id' => $dairy->id,
            'barcode' => '8964000333444',
            'name' => 'Fresh Milk 1L',
            'unit' => 'litre',
            'avg_cost' => 168,
            'sell_price' => 210,
            'stock_qty' => 75,
            'low_stock_threshold' => 20,
            'expiry_date' => now()->addDays(2)->toDateString(),
        ]);

        Vendor::create([
            'store_id' => $storeId,
            'name' => 'Nestle Wholesale',
            'phone' => '0300-1111111',
        ]);

        Customer::create([
            'store_id' => $storeId,
            'code' => 'C-1001',
            'name' => 'Bilal Ahmed',
            'phone' => '03001234567',
            'balance' => 82450,
        ]);
    }
}
