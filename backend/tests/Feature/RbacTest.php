<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, array{string, string}> */
    public static function ownerOnlyEndpoints(): array
    {
        return [
            'reports dashboard' => ['get', '/api/v1/reports/dashboard'],
            'reports summary' => ['get', '/api/v1/reports/summary'],
            'vendors list' => ['get', '/api/v1/vendors'],
            'purchases list' => ['get', '/api/v1/purchases'],
            'payables' => ['get', '/api/v1/payables'],
            'users list' => ['get', '/api/v1/users'],
        ];
    }

    #[DataProvider('ownerOnlyEndpoints')]
    public function test_cashier_is_blocked_from_owner_endpoints(string $method, string $url): void
    {
        $cashier = User::factory()->cashier()->create();

        $this->actingAs($cashier)->json($method, $url)->assertStatus(403);
    }

    #[DataProvider('ownerOnlyEndpoints')]
    public function test_owner_can_reach_owner_endpoints(string $method, string $url): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->json($method, $url)->assertOk();
    }

    public function test_cashier_cannot_create_products(): void
    {
        $cashier = User::factory()->cashier()->create();

        $this->actingAs($cashier)->postJson('/api/v1/inventory/products', [
            'name' => 'Hack Product',
            'unit' => 'pcs',
            'sell_price' => 10,
        ])->assertStatus(403);
    }

    public function test_manager_can_create_products(): void
    {
        $manager = User::factory()->manager()->create();

        $this->actingAs($manager)->postJson('/api/v1/inventory/products', [
            'name' => 'Sugar',
            'unit' => 'kg',
            'sell_price' => 150,
        ])->assertCreated();
    }

    public function test_manager_cannot_manage_users(): void
    {
        $manager = User::factory()->manager()->create();

        $this->actingAs($manager)->getJson('/api/v1/users')->assertStatus(403);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/reports/dashboard')->assertStatus(401);
    }
}
