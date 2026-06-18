<?php

namespace App\Modules\Sync\Http\Controllers;

use App\Modules\Sync\Services\CatalogPullService;
use App\Modules\Sync\Services\SaleSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class SyncController extends Controller
{
    public function __construct(
        private readonly SaleSyncService $sales,
        private readonly CatalogPullService $catalog,
    ) {}

    public function push(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => ['required', 'string', 'max:64'],
            'sales' => ['required', 'array', 'max:50'],
            'sales.*.client_id' => ['required', 'uuid'],
            'sales.*.sold_at' => ['required', 'date'],
            'sales.*.subtotal' => ['required', 'numeric', 'min:0'],
            'sales.*.discount' => ['nullable', 'numeric', 'min:0'],
            'sales.*.total' => ['required', 'numeric', 'min:0'],
            'sales.*.customer_id' => ['nullable', 'integer'],
            'sales.*.lines' => ['required', 'array', 'min:1'],
            'sales.*.lines.*.product_id' => ['nullable', 'integer'],
            'sales.*.lines.*.barcode' => ['nullable', 'string', 'max:80'],
            'sales.*.lines.*.name' => ['nullable', 'string', 'max:160'],
            'sales.*.lines.*.qty' => ['required', 'numeric', 'gt:0'],
            'sales.*.lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'sales.*.lines.*.line_total' => ['required', 'numeric', 'min:0'],
            'sales.*.payments' => ['required', 'array', 'min:1'],
            'sales.*.payments.*.method' => ['required', 'string', 'in:cash,card,wallet,khata,split'],
            'sales.*.payments.*.amount' => ['required', 'numeric', 'min:0'],
            'sales.*.payments.*.tendered' => ['nullable', 'numeric', 'min:0'],
            'sales.*.payments.*.change' => ['nullable', 'numeric', 'min:0'],
        ]);

        $results = [];

        foreach ($data['sales'] as $salePayload) {
            try {
                $results[] = $this->sales->pushOne($data['device_id'], $salePayload, $request->user());
            } catch (RuntimeException $e) {
                Log::warning('sync.push failed', ['client_id' => $salePayload['client_id'], 'error' => $e->getMessage()]);

                return response()->json([
                    'message' => $e->getMessage(),
                    'client_id' => $salePayload['client_id'],
                    'results' => $results,
                ], 409);
            }
        }

        return response()->json([
            'results' => $results,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $since = $request->query('since');

        return response()->json($this->catalog->pull(is_string($since) ? $since : null));
    }
}
