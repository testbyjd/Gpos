<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Tasks\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_task_for_self(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);

        $response = $this->actingAs($cashier)->postJson('/api/v1/tasks', [
            'title' => 'Shelf restock',
            'priority' => 'high',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('tasks', [
            'title' => 'Shelf restock',
            'assigned_to' => $cashier->id,
            'created_by' => $cashier->id,
            'priority' => 'high',
            'status' => 'open',
        ]);
    }

    public function test_owner_can_assign_task_to_cashier(): void
    {
        $owner = User::factory()->owner()->create();
        $cashier = User::factory()->create(['role' => 'cashier']);

        $response = $this->actingAs($owner)->postJson('/api/v1/tasks', [
            'title' => 'Count drawer',
            'assigned_to' => $cashier->id,
            'priority' => 'medium',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('tasks', [
            'assigned_to' => $cashier->id,
            'created_by' => $owner->id,
        ]);
    }

    public function test_cashier_cannot_assign_to_other_user(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);
        $other = User::factory()->create(['role' => 'cashier']);

        $this->actingAs($cashier)->postJson('/api/v1/tasks', [
            'title' => 'Not allowed',
            'assigned_to' => $other->id,
        ])->assertForbidden();
    }

    public function test_assignee_can_mark_task_done(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);
        $task = Task::create([
            'created_by' => $cashier->id,
            'assigned_to' => $cashier->id,
            'title' => 'Clean counter',
            'priority' => 'low',
            'status' => 'open',
        ]);

        $this->actingAs($cashier)->patchJson("/api/v1/tasks/{$task->id}", [
            'status' => 'done',
        ])->assertOk();

        $this->assertSame('done', $task->fresh()->status);
        $this->assertNotNull($task->fresh()->completed_at);
    }

    public function test_assignee_cannot_change_task_title(): void
    {
        $owner = User::factory()->owner()->create();
        $cashier = User::factory()->create(['role' => 'cashier']);
        $task = Task::create([
            'created_by' => $owner->id,
            'assigned_to' => $cashier->id,
            'title' => 'Count drawer',
            'priority' => 'high',
            'status' => 'open',
        ]);

        $this->actingAs($cashier)->patchJson("/api/v1/tasks/{$task->id}", [
            'title' => 'Hacked title',
        ])->assertForbidden();

        $this->assertSame('Count drawer', $task->fresh()->title);
    }

    public function test_owner_only_sees_tasks_for_their_store(): void
    {
        $storeA = DB::table('stores')->insertGetId([
            'name' => 'Store A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $storeB = DB::table('stores')->insertGetId([
            'name' => 'Store B',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $ownerA = User::factory()->owner()->create(['store_id' => $storeA]);
        $ownerB = User::factory()->owner()->create(['store_id' => $storeB]);

        Task::create([
            'store_id' => $storeA,
            'created_by' => $ownerA->id,
            'assigned_to' => $ownerA->id,
            'title' => 'Store A task',
            'priority' => 'medium',
            'status' => 'open',
        ]);
        Task::create([
            'store_id' => $storeB,
            'created_by' => $ownerB->id,
            'assigned_to' => $ownerB->id,
            'title' => 'Store B task',
            'priority' => 'medium',
            'status' => 'open',
        ]);

        $response = $this->actingAs($ownerA)->getJson('/api/v1/tasks');

        $response->assertOk();
        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Store A task', $titles);
        $this->assertNotContains('Store B task', $titles);
    }
}
