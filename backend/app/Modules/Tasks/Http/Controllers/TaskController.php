<?php

namespace App\Modules\Tasks\Http\Controllers;

use App\Models\User;
use App\Modules\Tasks\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $status = $request->query('status');

        $query = Task::query()
            ->with(['creator:id,name,role', 'assignee:id,name,role']);

        $this->scopeStore($query, $user);

        if ($user->role !== 'owner') {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)
                    ->orWhere('created_by', $user->id);
            });
        }

        if ($status === 'open' || $status === 'done') {
            $query->where('status', $status);
        }

        $tasks = $query
            ->orderByRaw("CASE status WHEN 'open' THEN 0 ELSE 1 END")
            ->orderByRaw("CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END")
            ->orderByRaw('due_at NULLS LAST')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $tasks]);
    }

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Task::query()->where('status', 'open')->where('assigned_to', $user->id);
        $this->scopeStore($query, $user);

        return response()->json([
            'open_assigned' => (clone $query)->count(),
            'open_high' => (clone $query)->where('priority', 'high')->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:2000'],
            'priority' => ['nullable', 'in:low,medium,high'],
            'due_at' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $assignedTo = (int) ($data['assigned_to'] ?? $user->id);

        if ($user->role !== 'owner' && $assignedTo !== $user->id) {
            return response()->json(['message' => 'Sirf owner doosre user ko task assign kar sakta hai.'], 403);
        }

        $assignee = User::query()->where('id', $assignedTo)->where('is_active', true)->first();
        if (! $assignee) {
            return response()->json(['message' => 'Assign user nahi mila.'], 422);
        }

        $task = Task::create([
            'store_id' => $user->store_id,
            'created_by' => $user->id,
            'assigned_to' => $assignedTo,
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'priority' => $data['priority'] ?? 'medium',
            'status' => 'open',
            'due_at' => $data['due_at'] ?? null,
        ]);

        $task->load(['creator:id,name,role', 'assignee:id,name,role']);

        return response()->json(['data' => $task], 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        if (! $this->canAccessStore($user, $task) || ! $this->canManage($user, $task)) {
            return response()->json(['message' => 'Is task ko edit karne ki permission nahi.'], 403);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:2000'],
            'priority' => ['sometimes', 'in:low,medium,high'],
            'status' => ['sometimes', 'in:open,done'],
            'due_at' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if (array_key_exists('assigned_to', $data)) {
            $assignedTo = $data['assigned_to'] ?? $task->assigned_to;
            if ($user->role !== 'owner') {
                return response()->json(['message' => 'Sirf owner assignee change kar sakta hai.'], 403);
            }
            $assignee = User::query()->where('id', $assignedTo)->where('is_active', true)->first();
            if (! $assignee) {
                return response()->json(['message' => 'Assign user nahi mila.'], 422);
            }
            $task->assigned_to = $assignedTo;
        }

        if (isset($data['title'])) {
            $task->title = $data['title'];
        }
        if (array_key_exists('body', $data)) {
            $task->body = $data['body'];
        }
        if (isset($data['priority'])) {
            $task->priority = $data['priority'];
        }
        if (isset($data['due_at'])) {
            $task->due_at = $data['due_at'];
        }
        if (array_key_exists('due_at', $data) && $data['due_at'] === null) {
            $task->due_at = null;
        }

        if (isset($data['status'])) {
            $task->status = $data['status'];
            $task->completed_at = $data['status'] === 'done' ? now() : null;
        }

        if ($user->role !== 'owner' && $task->created_by !== $user->id) {
            // Assignee can only toggle done/open — not edit title/priority/assignee.
            $dirty = $task->getDirty();
            unset($dirty['status'], $dirty['completed_at']);
            if ($dirty !== []) {
                return response()->json(['message' => 'Sirf status update kar sakte ho.'], 403);
            }
        }

        $task->save();
        $task->load(['creator:id,name,role', 'assignee:id,name,role']);

        return response()->json(['data' => $task]);
    }

    public function destroy(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        if (! $this->canAccessStore($user, $task)) {
            return response()->json(['message' => 'Is task ko delete karne ki permission nahi.'], 403);
        }

        if ($user->role !== 'owner' && $task->created_by !== $user->id) {
            return response()->json(['message' => 'Sirf creator ya owner delete kar sakta hai.'], 403);
        }

        $task->delete();

        return response()->json(['ok' => true]);
    }

    private function canManage(User $user, Task $task): bool
    {
        if ($user->role === 'owner') {
            return true;
        }
        if ($task->assigned_to === $user->id) {
            return true;
        }
        if ($task->created_by === $user->id && $task->status === 'open') {
            return true;
        }

        return false;
    }

    /** Limit tasks to the signed-in user's store (multi-store safe). */
    private function scopeStore($query, User $user): void
    {
        if ($user->store_id !== null) {
            $query->where('store_id', $user->store_id);
        }
    }

    private function canAccessStore(User $user, Task $task): bool
    {
        if ($user->store_id === null) {
            return true;
        }

        return $task->store_id === $user->store_id;
    }
}
