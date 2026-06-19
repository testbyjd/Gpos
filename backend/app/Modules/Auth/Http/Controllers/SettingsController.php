<?php

namespace App\Modules\Auth\Http\Controllers;

use App\Modules\Auth\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SettingsController extends Controller
{
    private const RECEIPT_DEFAULTS = [
        'shop_name' => 'Gondal Traders',
        'tagline' => '',
        'address' => '',
        'phone' => '',
        'footer_note' => 'Shukria! Dobara tashreef laaiye.',
        'paper_width' => '80',
        'show_cashier' => true,
        'show_customer' => true,
    ];

    public function receipt(): JsonResponse
    {
        return response()->json([
            'data' => Setting::get('receipt', self::RECEIPT_DEFAULTS),
        ]);
    }

    public function updateReceipt(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shop_name' => ['required', 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'footer_note' => ['nullable', 'string', 'max:255'],
            'paper_width' => ['required', 'in:58,80'],
            'show_cashier' => ['boolean'],
            'show_customer' => ['boolean'],
        ]);

        Setting::put('receipt', array_merge(self::RECEIPT_DEFAULTS, $data));

        return response()->json([
            'ok' => true,
            'message' => 'Receipt settings save ho gayi.',
            'data' => Setting::get('receipt', self::RECEIPT_DEFAULTS),
        ]);
    }
}
