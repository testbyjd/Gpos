<?php

namespace App\Modules\Sales\Services;

use App\Modules\Customers\Models\Customer;
use App\Modules\Customers\Models\CustomerLedgerEntry;
use App\Modules\Inventory\Services\StockService;
use App\Modules\Sales\Models\SaleReturn;
use App\Modules\Sales\Models\SaleReturnLine;
use Illuminate\Support\Facades\DB;

class SaleReturnService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, ?int $userId = null): SaleReturn
    {
        return DB::transaction(function () use ($data, $userId) {
            $total = collect($data['lines'])->sum(fn ($line) => (float) $line['qty'] * (float) $line['unit_price']);
            $method = $data['refund_method'] ?? 'cash';

            $return = SaleReturn::create([
                'store_id' => $data['store_id'] ?? null,
                'sale_id' => $data['sale_id'] ?? null,
                'customer_id' => $data['customer_id'] ?? null,
                'return_no' => 'SR-PENDING',
                'total' => $total,
                'refund_method' => $method,
                'note' => $data['note'] ?? null,
                'returned_at' => $data['returned_at'] ?? now(),
                'created_by' => $userId,
            ]);

            $return->update(['return_no' => 'SR-'.$return->id]);

            foreach ($data['lines'] as $line) {
                $qty = (float) $line['qty'];
                $unitPrice = (float) $line['unit_price'];

                SaleReturnLine::create([
                    'sale_return_id' => $return->id,
                    'product_id' => $line['product_id'],
                    'qty' => $qty,
                    'unit_price' => $unitPrice,
                    'line_total' => $qty * $unitPrice,
                ]);

                // Returned goods come back into stock.
                $this->stock->record(
                    (int) $line['product_id'],
                    $qty,
                    'sale_return',
                    'sale_return',
                    $return->id,
                    $userId,
                    $return->return_no,
                );
            }

            // Khata refund reduces what the customer owes; cash refund is paid out at the till.
            if ($method === 'khata' && ! empty($data['customer_id'])) {
                $customer = Customer::lockForUpdate()->find($data['customer_id']);
                if ($customer) {
                    $customer->balance = max(0, (float) bcsub((string) $customer->balance, (string) $total, 2));
                    $customer->save();

                    CustomerLedgerEntry::create([
                        'customer_id' => $customer->id,
                        'type' => 'adjustment',
                        'amount' => -abs((float) $total),
                        'balance_after' => $customer->balance,
                        'reference_type' => 'sale_return',
                        'reference_id' => $return->id,
                        'note' => $return->return_no,
                        'created_by' => $userId,
                    ]);
                }
            }

            return $return->load(['customer', 'lines.product']);
        });
    }
}
