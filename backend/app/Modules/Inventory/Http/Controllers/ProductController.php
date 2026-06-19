<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Modules\Inventory\Http\Resources\ProductResource;
use App\Modules\Inventory\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $products = Product::query()
            ->with('category')
            ->when($request->query('active', '1') !== 'all', fn ($query) => $query->where('is_active', true))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('name', 'ilike', "%{$q}%")
                        ->orWhere('barcode', 'ilike', "%{$q}%")
                        ->orWhere('sku', 'ilike', "%{$q}%");
                });
            })
            ->when($request->query('barcode'), fn ($query, $barcode) => $query->where('barcode', $barcode))
            ->when($request->query('category_id'), fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->orderBy('name')
            ->paginate((int) $request->query('per_page', 100));

        return response()->json([
            'data' => ProductResource::collection($products->items()),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $product = Product::create($this->validated($request));

        return response()->json(['data' => new ProductResource($product->load('category'))], 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json(['data' => new ProductResource($product->load('category'))]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $product->update($this->validated($request, partial: true));

        return response()->json(['data' => new ProductResource($product->load('category'))]);
    }

    public function destroy(Product $product): JsonResponse
    {
        if ($product->isInUse()) {
            $product->update(['is_active' => false]);

            return response()->json([
                'ok' => true,
                'action' => 'deactivated',
                'message' => 'Product is used in sales, purchases, or stock history — marked inactive instead of deleted.',
            ]);
        }

        $product->delete();

        return response()->json([
            'ok' => true,
            'action' => 'deleted',
            'message' => 'Product deleted.',
        ]);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'sku' => ['nullable', 'string', 'max:80'],
            'barcode' => ['nullable', 'string', 'max:80'],
            'name' => [$required, 'string', 'max:160'],
            'brand' => ['nullable', 'string', 'max:120'],
            'unit' => [$required, 'string', 'max:20'],
            'unit_precision' => ['nullable', 'integer', 'min:0', 'max:3'],
            'avg_cost' => ['nullable', 'numeric', 'min:0'],
            'sell_price' => [$required, 'numeric', 'min:0'],
            'stock_qty' => ['nullable', 'numeric'],
            'low_stock_threshold' => ['nullable', 'numeric', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (array_key_exists('barcode', $data)) {
            $data['barcode'] = trim((string) $data['barcode']) ?: null;
        }
        if (array_key_exists('sku', $data)) {
            $data['sku'] = trim((string) ($data['sku'] ?? '')) ?: null;
        }

        return $data;
    }
}
