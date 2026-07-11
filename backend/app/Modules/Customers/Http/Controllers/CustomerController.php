<?php

namespace App\Modules\Customers\Http\Controllers;

use App\Modules\Customers\Models\Customer;
use App\Modules\Customers\Models\CustomerLedgerEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        return response()->json([
            'data' => Customer::query()
                ->when($q !== '', function ($query) use ($q) {
                    $query->where(function ($inner) use ($q) {
                        $inner->where('name', 'ilike', "%{$q}%")
                            ->orWhere('phone', 'ilike', "%{$q}%")
                            ->orWhere('code', 'ilike', "%{$q}%");
                    });
                })
                ->where('is_active', true)
                ->orderByDesc('ranking')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'code' => ['nullable', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'ranking' => ['nullable', 'integer', 'min:0', 'max:5'],
        ]);

        $customer = Customer::create([
            ...$data,
            'ranking' => (int) ($data['ranking'] ?? 0),
        ]);

        return response()->json(['data' => $customer], 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'code' => ['nullable', 'string', 'max:40'],
            'ranking' => ['nullable', 'integer', 'min:0', 'max:5'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $customer->fill($data);
        $customer->save();

        return response()->json(['data' => $customer->fresh()]);
    }

    public function ledger(Customer $customer): JsonResponse
    {
        return response()->json([
            'customer' => $customer,
            'entries' => CustomerLedgerEntry::where('customer_id', $customer->id)->latest()->get(),
        ]);
    }

    public function repayment(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        return DB::transaction(function () use ($customer, $data, $request) {
            $customer = Customer::lockForUpdate()->findOrFail($customer->id);
            $customer->balance = bcsub((string) $customer->balance, (string) $data['amount'], 2);
            $customer->save();

            $entry = CustomerLedgerEntry::create([
                'customer_id' => $customer->id,
                'type' => 'repayment',
                'amount' => -abs((float) $data['amount']),
                'balance_after' => $customer->balance,
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()?->id,
            ]);

            return response()->json(['data' => $entry, 'customer' => $customer]);
        });
    }
}
