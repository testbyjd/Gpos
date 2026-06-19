<?php

namespace App\Modules\Vendors\Http\Controllers;

use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class PayableController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'total_payable' => (float) Vendor::sum('balance'),
            'vendors' => Vendor::where('balance', '>', 0)->orderByDesc('balance')->get(),
            'open_invoices' => Purchase::with('vendor')->where('balance_amount', '>', 0)->latest('received_at')->get(),
        ]);
    }

    public function recordPayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purchase_id' => ['required', 'integer', 'exists:purchases,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        return DB::transaction(function () use ($data) {
            $purchase = Purchase::lockForUpdate()->with('vendor')->findOrFail($data['purchase_id']);
            $balance = (float) $purchase->balance_amount;

            if ($balance <= 0) {
                return response()->json(['message' => 'Invoice already settled.'], 422);
            }

            $amount = min((float) $data['amount'], $balance);
            $purchase->paid_amount = bcadd((string) $purchase->paid_amount, (string) $amount, 2);
            $purchase->balance_amount = bcsub((string) $purchase->balance_amount, (string) $amount, 2);
            $purchase->save();

            $vendor = Vendor::lockForUpdate()->findOrFail($purchase->vendor_id);
            $vendor->balance = max(0, (float) bcsub((string) $vendor->balance, (string) $amount, 2));
            $vendor->save();

            return response()->json([
                'ok' => true,
                'message' => "Payment of {$amount} recorded for {$purchase->grn_no}.",
                'purchase' => $purchase->fresh('vendor'),
                'vendor' => $vendor,
            ]);
        });
    }
}
