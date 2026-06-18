<?php

namespace App\Modules\Vendors\Http\Controllers;

use App\Modules\Vendors\Models\Purchase;
use App\Modules\Vendors\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

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
}
