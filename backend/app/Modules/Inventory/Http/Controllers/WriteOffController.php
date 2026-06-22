<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Modules\Inventory\Models\StockWriteOff;
use App\Modules\Inventory\Services\WriteOffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;

class WriteOffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $writeOffs = StockWriteOff::query()
            ->with(['product:id,name,unit,barcode', 'creator:id,name'])
            ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->date('from')->startOfDay()))
            ->when($request->filled('to'), fn ($q) => $q->where('created_at', '<=', $request->date('to')->endOfDay()))
            ->latest()
            ->paginate((int) $request->query('per_page', 50));

        return response()->json([
            'data' => $writeOffs->items(),
            'meta' => [
                'current_page' => $writeOffs->currentPage(),
                'last_page' => $writeOffs->lastPage(),
                'total' => $writeOffs->total(),
            ],
        ]);
    }

    public function store(Request $request, WriteOffService $service): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'qty' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', Rule::in(StockWriteOff::REASONS)],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $writeOff = $service->create($data, $request->user()?->id);

        return response()->json([
            'data' => $writeOff,
            'message' => 'Stock write-off record ho gaya.',
        ], 201);
    }

    public function reasons(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['value' => 'expired', 'label' => 'Expired'],
                ['value' => 'damage', 'label' => 'Damage / broken'],
                ['value' => 'gift_sample', 'label' => 'Gift / sample'],
                ['value' => 'theft', 'label' => 'Theft / missing'],
            ],
        ]);
    }
}
