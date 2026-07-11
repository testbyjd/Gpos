<?php

namespace App\Modules\Expenses\Http\Controllers;

use App\Modules\Expenses\Models\Expense;
use App\Modules\Expenses\Models\ExpenseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $from = $request->query('from', now()->toDateString());
        $to = $request->query('to', $from);
        $categoryId = $request->query('category_id');

        $query = Expense::query()
            ->with(['creator:id,name,role', 'category:id,name'])
            ->whereDate('spent_on', '>=', $from)
            ->whereDate('spent_on', '<=', $to)
            ->when($categoryId, fn ($q) => $q->where('category_id', (int) $categoryId))
            ->when($request->user()?->store_id, fn ($q, $storeId) => $q->where(function ($inner) use ($storeId) {
                $inner->where('store_id', $storeId)->orWhereNull('store_id');
            }))
            ->orderByDesc('spent_on')
            ->orderByDesc('id');

        $expenses = $query->get();
        $total = (float) $expenses->sum(fn (Expense $e) => (float) $e->amount);

        $today = now()->toDateString();
        $todayTotal = (float) Expense::query()
            ->whereDate('spent_on', $today)
            ->when($request->user()?->store_id, fn ($q, $storeId) => $q->where(function ($inner) use ($storeId) {
                $inner->where('store_id', $storeId)->orWhereNull('store_id');
            }))
            ->sum('amount');

        $byCategory = $expenses
            ->groupBy(fn (Expense $e) => $e->category?->name ?? 'Uncategorized')
            ->map(fn ($rows, $name) => [
                'category' => $name,
                'category_id' => $rows->first()?->category_id,
                'total' => round($rows->sum(fn (Expense $e) => (float) $e->amount), 2),
                'count' => $rows->count(),
            ])
            ->values();

        return response()->json([
            'data' => $expenses,
            'summary' => [
                'from' => $from,
                'to' => $to,
                'period_total' => round($total, 2),
                'today_total' => round($todayTotal, 2),
                'count' => $expenses->count(),
                'by_category' => $byCategory,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $user = $request->user();

        $expense = Expense::create([
            ...$data,
            'store_id' => $user?->store_id,
            'created_by' => $user?->id,
            'payment_method' => $data['payment_method'] ?? 'cash',
            'note' => isset($data['note']) ? (trim((string) $data['note']) ?: null) : null,
        ]);

        return response()->json([
            'data' => $expense->load(['creator:id,name,role', 'category:id,name']),
        ], 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $data = $this->validated($request, updating: true);
        if (array_key_exists('note', $data)) {
            $data['note'] = trim((string) ($data['note'] ?? '')) ?: null;
        }
        $expense->fill($data);
        $expense->save();

        return response()->json([
            'data' => $expense->fresh()->load(['creator:id,name,role', 'category:id,name']),
        ]);
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $expense->delete();

        return response()->json(['ok' => true]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';

        return $request->validate([
            'category_id' => [
                $required,
                'integer',
                Rule::exists('expense_categories', 'id')->where(fn ($q) => $q->where('is_active', true)),
            ],
            'amount' => [$required, 'numeric', 'gt:0', 'max:9999999.99'],
            'payment_method' => ['nullable', 'string', Rule::in(Expense::PAYMENT_METHODS)],
            'spent_on' => [$required, 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
    }
}
