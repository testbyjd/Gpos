<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Modules\Inventory\Http\Resources\ProductResource;
use App\Modules\Inventory\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $query = Product::query()
            ->with('category')
            ->when($request->query('active', '1') !== 'all', fn ($builder) => $builder->where('is_active', true))
            ->when($q !== '', function ($builder) use ($q) {
                $builder->where(function ($inner) use ($q) {
                    $inner->where('name', 'ilike', "%{$q}%")
                        ->orWhere('barcode', 'ilike', "%{$q}%")
                        ->orWhere('sku', 'ilike', "%{$q}%");
                });
            })
            ->when($request->query('barcode'), fn ($builder, $barcode) => $builder->where('barcode', $barcode))
            ->when($request->query('category_id'), fn ($builder, $categoryId) => $builder->where('category_id', $categoryId))
            ->when($request->boolean('low_stock'), fn ($builder) => $builder->whereColumn('stock_qty', '<=', 'low_stock_threshold'))
            ->when($request->boolean('stock_ok'), fn ($builder) => $builder->whereColumn('stock_qty', '>', 'low_stock_threshold'))
            ->when($request->filled('expiring_within'), function ($builder) use ($request) {
                $days = max(1, (int) $request->query('expiring_within', 30));
                $builder->whereNotNull('expiry_date')
                    ->where('expiry_date', '<=', now()->addDays($days)->endOfDay());
            })
            ->orderBy('name');

        $perPage = min(200, max(1, (int) $request->query('per_page', 100)));
        $products = (clone $query)->paginate($perPage);

        $active = Product::query()->where('is_active', true);
        $summary = [
            'total' => (clone $active)->count(),
            'low_stock' => (clone $active)->whereColumn('stock_qty', '<=', 'low_stock_threshold')->count(),
            'expiring_soon' => (clone $active)
                ->whereNotNull('expiry_date')
                ->where('expiry_date', '<=', now()->addDays(30)->endOfDay())
                ->count(),
            'inventory_value' => (float) ((clone $active)->selectRaw('COALESCE(SUM(stock_qty * avg_cost), 0) as v')->value('v') ?? 0),
        ];

        return response()->json([
            'data' => ProductResource::collection($products->items()),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
            'summary' => $summary,
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

        $product->deleteStoredImage();
        $product->delete();

        return response()->json([
            'ok' => true,
            'action' => 'deleted',
            'message' => 'Product deleted.',
        ]);
    }

    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        $product->deleteStoredImage();

        $ext = $request->file('image')->guessExtension() ?: 'jpg';
        $path = $request->file('image')->storeAs(
            "products/{$product->id}",
            Str::uuid()->toString().'.'.$ext,
            'public',
        );

        $product->update(['image_path' => $path]);

        return response()->json(['data' => new ProductResource($product->load('category'))]);
    }

    public function deleteImage(Product $product): JsonResponse
    {
        $product->deleteStoredImage();
        $product->update(['image_path' => null]);

        return response()->json(['data' => new ProductResource($product->load('category'))]);
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
