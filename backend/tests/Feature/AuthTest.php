<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_with_valid_credentials(): void
    {
        User::factory()->owner()->create([
            'email' => 'owner@gondal.local',
            'password' => Hash::make('secret123'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'owner@gondal.local',
            'password' => 'secret123',
        ])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']])
            ->assertJsonPath('user.role', 'owner');
    }

    public function test_login_rejects_wrong_password(): void
    {
        User::factory()->create([
            'email' => 'cashier@gondal.local',
            'password' => Hash::make('secret123'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@gondal.local',
            'password' => 'wrong',
        ])->assertStatus(422);
    }

    public function test_login_rejects_inactive_user(): void
    {
        User::factory()->create([
            'email' => 'gone@gondal.local',
            'password' => Hash::make('secret123'),
            'is_active' => false,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'gone@gondal.local',
            'password' => 'secret123',
        ])->assertStatus(422);
    }

    public function test_manager_pin_verification(): void
    {
        $manager = User::factory()->manager()->create([
            'pin_hash' => Hash::make('4321'),
        ]);

        $this->actingAs($manager)
            ->postJson('/api/v1/auth/verify-pin', ['pin' => '4321'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($manager)
            ->postJson('/api/v1/auth/verify-pin', ['pin' => '0000'])
            ->assertStatus(403);
    }

    public function test_cashier_can_use_manager_override_pin(): void
    {
        User::factory()->manager()->create([
            'pin_hash' => Hash::make('4321'),
        ]);
        $cashier = User::factory()->cashier()->create([
            'pin_hash' => Hash::make('9999'),
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/auth/verify-pin', ['pin' => '4321'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($cashier)
            ->postJson('/api/v1/auth/verify-pin', ['pin' => '9999'])
            ->assertStatus(403);
    }
}
