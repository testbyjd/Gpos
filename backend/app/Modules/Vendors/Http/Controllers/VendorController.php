<?php

namespace App\Modules\Vendors\Http\Controllers;

use App\Modules\Vendors\Models\Vendor;
use App\Modules\Vendors\Models\VendorContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class VendorController extends Controller
{
    private const CONTACT_ROLES = ['salesperson', 'delivery', 'accounts', 'owner', 'other'];

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $vendors = Vendor::query()
            ->with('contacts')
            ->when($request->query('active', '1') !== 'all', fn ($query) => $query->where('is_active', true))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('name', 'ilike', "%{$q}%")
                        ->orWhere('phone', 'ilike', "%{$q}%");
                });
            })
            ->orderByDesc('ranking')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $vendors]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
            'ranking' => ['nullable', 'integer', 'min:0', 'max:5'],
        ]);

        $vendor = Vendor::create([
            ...$data,
            'ranking' => (int) ($data['ranking'] ?? 0),
        ]);

        return response()->json(['data' => $vendor->load('contacts')], 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        $vendor->load('contacts');

        return response()->json([
            'vendor' => $vendor,
            'purchases' => $vendor->purchases()
                ->with('lines.product:id,name,barcode,stock_qty,unit')
                ->latest('received_at')
                ->get(),
            'payments' => $vendor->payments()
                ->with('purchase:id,grn_no')
                ->latest()
                ->get(),
            'returns' => $vendor->returns()
                ->with('lines.product:id,name,barcode')
                ->latest('returned_at')
                ->get(),
        ]);
    }

    public function update(Request $request, Vendor $vendor): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
            'ranking' => ['nullable', 'integer', 'min:0', 'max:5'],
            'is_active' => ['nullable', 'boolean'],
            'contacts' => ['nullable', 'array'],
            'contacts.*.id' => ['nullable', 'integer'],
            'contacts.*.name' => ['required_with:contacts', 'string', 'max:160'],
            'contacts.*.phone' => ['nullable', 'string', 'max:40'],
            'contacts.*.role' => ['required_with:contacts', 'string', 'in:'.implode(',', self::CONTACT_ROLES)],
            'contacts.*.note' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($vendor, $data) {
            $vendor->fill(collect($data)->except('contacts')->all());
            $vendor->save();

            if (array_key_exists('contacts', $data)) {
                $this->syncContacts($vendor, $data['contacts'] ?? []);
            }
        });

        return response()->json(['data' => $vendor->fresh()->load('contacts')]);
    }

    /** @param  array<int, array<string, mixed>>  $contacts */
    private function syncContacts(Vendor $vendor, array $contacts): void
    {
        $keptIds = [];

        foreach ($contacts as $row) {
            $payload = [
                'name' => trim((string) $row['name']),
                'phone' => isset($row['phone']) ? (trim((string) $row['phone']) ?: null) : null,
                'role' => $row['role'],
                'note' => isset($row['note']) ? (trim((string) $row['note']) ?: null) : null,
            ];

            if (! empty($row['id'])) {
                $contact = VendorContact::query()
                    ->where('vendor_id', $vendor->id)
                    ->where('id', $row['id'])
                    ->first();
                if ($contact) {
                    $contact->update($payload);
                    $keptIds[] = $contact->id;
                    continue;
                }
            }

            $created = $vendor->contacts()->create($payload);
            $keptIds[] = $created->id;
        }

        VendorContact::query()
            ->where('vendor_id', $vendor->id)
            ->when(count($keptIds) > 0, fn ($q) => $q->whereNotIn('id', $keptIds), fn ($q) => $q)
            ->delete();
    }
}
