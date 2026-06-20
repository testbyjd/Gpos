<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class GposSeeder extends Seeder
{
    public function run(): void
    {
        $storeId = DB::table('stores')->insertGetId([
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
    }
}
