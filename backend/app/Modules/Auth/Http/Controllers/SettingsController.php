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
        'font_size' => 12,
        'font_weight' => 700,
        'title_size' => 17,
        'line_height' => 1.35,
        'padding' => 12,
        'section_gap' => 7,
    ];

    public function receipt(): JsonResponse
    {
        return response()->json([
            'data' => array_merge(self::RECEIPT_DEFAULTS, Setting::get('receipt', [])),
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
            'paper_width' => ['required', 'in:58,80,110,112'],
            'show_cashier' => ['boolean'],
            'show_customer' => ['boolean'],
            'font_size' => ['nullable', 'numeric', 'min:10', 'max:18'],
            'font_weight' => ['nullable', 'integer', 'min:400', 'max:900'],
            'title_size' => ['nullable', 'numeric', 'min:12', 'max:26'],
            'line_height' => ['nullable', 'numeric', 'min:1.1', 'max:1.9'],
            'padding' => ['nullable', 'numeric', 'min:4', 'max:24'],
            'section_gap' => ['nullable', 'numeric', 'min:2', 'max:16'],
        ]);

        $merged = array_merge(self::RECEIPT_DEFAULTS, $data);
        $merged['font_size'] = (float) $merged['font_size'];
        $merged['font_weight'] = (int) $merged['font_weight'];
        $merged['title_size'] = (float) $merged['title_size'];
        $merged['line_height'] = (float) $merged['line_height'];
        $merged['padding'] = (float) $merged['padding'];
        $merged['section_gap'] = (float) $merged['section_gap'];

        Setting::put('receipt', $merged);

        return response()->json([
            'ok' => true,
            'message' => 'Receipt settings save ho gayi.',
            'data' => array_merge(self::RECEIPT_DEFAULTS, Setting::get('receipt', [])),
        ]);
    }
}
