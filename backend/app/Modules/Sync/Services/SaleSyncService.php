<?php

namespace App\Modules\Sync\Services;

use App\Models\User;
use App\Modules\Customers\Models\Customer;
use App\Modules\Customers\Models\CustomerLedgerEntry;
use App\Modules\Inventory\Models\Category;
use App\Modules\Inventory\Models\Product;
use App\Modules\Inventory\Services\StockService;
use App\Modules\Sales\Models\Sale;
use App\Modules\Sales\Models\SaleLine;
use App\Modules\Sales\Models\SalePayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class SaleSyncService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array{client_id: string, status: string, server_id: int, invoice_no: string}
     */
    public function pushOne(string $deviceId, array $payload, ?User $user = null): array
    {
        $clientId = $payload['client_id'];

        $existing = Sale::where('client_id', $clientId)->first();
        if ($existing) {
            $this->logSync($deviceId, $clientId, 'already_synced', $existing->id, $payload);

            return [
                'client_id' => $clientId,
                'status' => 'already_synced',
                'server_id' => $existing->id,
                'invoice_no' => $existing->invoice_no,
            ];
        }

        return DB::transaction(function () use ($deviceId, $payload, $clientId, $user) {
            $this->assertValidDiscount($payload);

            $sale = Sale::create([
                'client_id' => $clientId,
                'device_id' => $deviceId,
                'store_id' => $user?->store_id,
                'invoice_no' => 'PENDING',
                'cashier_id' => $user?->id,
                'customer_id' => $payload['customer_id'] ?? null,
                'subtotal' => $payload['subtotal'],
                'discount' => $payload['discount'] ?? 0,
                'discount_recipient_name' => isset($payload['discount_recipient_name'])
                    ? trim((string) $payload['discount_recipient_name']) ?: null
                    : null,
                'discount_reason' => isset($payload['discount_reason'])
                    ? trim((string) $payload['discount_reason']) ?: null
                    : null,
                'total' => $payload['total'],
                'sold_at' => now(),
                'synced_at' => now(),
            ]);

            $sale->update(['invoice_no' => 'INV-'.$sale->id]);

            foreach ($payload['lines'] as $line) {
                $product = ! empty($line['product_id'])
                    ? Product::find($line['product_id'])
                    : null;

                if (! $product && ! empty($line['barcode'])) {
                    $product = Product::where('barcode', $line['barcode'])->first();
                }

                if (! $product) {
                    throw new RuntimeException('Product not found for synced sale line: '.($line['name'] ?? 'unknown'));
                }

                SaleLine::create([
                    'sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'qty' => $line['qty'],
                    'unit_price' => $line['unit_price'],
                    'line_total' => $line['line_total'],
                    'cost_at_sale' => $product->avg_cost,
                ]);

                $this->stock->deductForSale(
                    $product->id,
                    (float) $line['qty'],
                    $sale->id,
                    $user?->id,
                );
            }

            foreach ($payload['payments'] as $payment) {
                SalePayment::create([
                    'sale_id' => $sale->id,
                    'method' => $payment['method'],
                    'amount' => $payment['amount'],
                    'tendered' => $payment['tendered'] ?? null,
                    'change_amount' => $payment['change'] ?? null,
                    'reference_id' => isset($payment['reference_id'])
                        ? (trim((string) $payment['reference_id']) ?: null)
                        : null,
                ]);

                if ($payment['method'] === 'khata') {
                    if (! $sale->customer_id) {
                        throw new RuntimeException('Khata / udhar ke liye customer select karna lazmi hai.');
                    }
                    $customer = Customer::lockForUpdate()->find($sale->customer_id);
                    if ($customer) {
                        $customer->balance = bcadd((string) $customer->balance, (string) $payment['amount'], 2);
                        $customer->save();

                        CustomerLedgerEntry::create([
                            'customer_id' => $customer->id,
                            'type' => 'sale_credit',
                            'amount' => abs((float) $payment['amount']),
                            'balance_after' => $customer->balance,
                            'reference_type' => 'sale',
                            'reference_id' => $sale->id,
                            'note' => $sale->invoice_no,
                            'created_by' => $user?->id,
                        ]);
                    }
                }
            }

            $this->logSync($deviceId, $clientId, 'created', $sale->id, $payload);

            return [
                'client_id' => $clientId,
                'status' => 'created',
                'server_id' => $sale->id,
                'invoice_no' => $sale->invoice_no,
            ];
        });
    }

    /** @param  array<string, mixed>  $payload */
    private function assertValidDiscount(array $payload): void
    {
        $subtotal = (float) ($payload['subtotal'] ?? 0);
        $discount = (float) ($payload['discount'] ?? 0);

        if ($discount > $subtotal) {
            throw new RuntimeException('Discount subtotal se zyada nahi ho sakta.');
        }

        if ($subtotal <= 0 || $discount <= 0) {
            return;
        }

        if ($discount > ($subtotal * 0.05)) {
            $name = trim((string) ($payload['discount_recipient_name'] ?? ''));
            $reason = trim((string) ($payload['discount_reason'] ?? ''));
            if ($name === '' || $reason === '') {
                throw new RuntimeException('5% se zyada discount pe naam aur reason zaroori hain.');
            }
        }
    }

    /** @param  array<string, mixed>  $payload */
    private function logSync(string $deviceId, string $clientId, string $status, int $serverId, array $payload): void
    {
        if (! Schema::hasTable('sync_log')) {
            return;
        }

        DB::table('sync_log')->updateOrInsert(
            ['client_id' => $clientId, 'entity_type' => 'sale'],
            [
                'device_id' => $deviceId,
                'status' => $status,
                'server_id' => $serverId,
                'payload' => json_encode($payload),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }
}
