<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserPasswordUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_update_any_user_password(): void
    {
        $owner = User::factory()->owner()->create();
        $cashier = User::factory()->cashier()->create([
            'email' => 'cashier@test.local',
            'password' => Hash::make('old-pass'),
        ]);

        $this->actingAs($owner)
            ->patchJson("/api/v1/users/{$cashier->id}/password", ['password' => 'new-secret'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $cashier->refresh();
        $this->assertTrue(Hash::check('new-secret', $cashier->password));
    }

    public function test_manager_cannot_update_user_passwords(): void
    {
        $manager = User::factory()->manager()->create();
        $cashier = User::factory()->cashier()->create();

        $this->actingAs($manager)
            ->patchJson("/api/v1/users/{$cashier->id}/password", ['password' => 'hacked123'])
            ->assertStatus(403);
    }

    public function test_password_must_be_at_least_six_characters(): void
    {
        $owner = User::factory()->owner()->create();
        $cashier = User::factory()->cashier()->create();

        $this->actingAs($owner)
            ->patchJson("/api/v1/users/{$cashier->id}/password", ['password' => '123'])
            ->assertStatus(422);
    }
}
