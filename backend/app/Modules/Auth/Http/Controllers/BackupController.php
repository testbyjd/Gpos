<?php

namespace App\Modules\Auth\Http\Controllers;

use App\Support\DatabaseBackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class BackupController extends Controller
{
    public function export(DatabaseBackupService $backup): StreamedResponse
    {
        $payload = $backup->export();
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            abort(500, 'Backup encode fail.');
        }

        $filename = 'gpos-backup-'.now()->format('Y-m-d-His').'.json';

        return response()->streamDownload(function () use ($json): void {
            echo $json;
        }, $filename, [
            'Content-Type' => 'application/json; charset=UTF-8',
        ]);
    }

    public function import(Request $request, DatabaseBackupService $backup): JsonResponse
    {
        $request->validate([
            'confirm' => ['required', 'string'],
            'file' => ['required', 'file', 'max:102400'], // 100 MB
        ]);

        if (trim((string) $request->input('confirm')) !== DatabaseBackupService::RESTORE_CONFIRM) {
            return response()->json([
                'message' => 'Confirm box mein exactly RESTORE likho (sab caps).',
            ], 422);
        }

        $file = $request->file('file');
        if ($file === null) {
            return response()->json(['message' => 'Backup file missing.'], 422);
        }

        $raw = file_get_contents($file->getRealPath());
        if ($raw === false || trim($raw) === '') {
            return response()->json(['message' => 'Backup file empty ya read nahi hui.'], 422);
        }

        try {
            $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return response()->json(['message' => 'Backup JSON parse nahi hua — file corrupt ho sakti hai.'], 422);
        }

        if (! is_array($payload)) {
            return response()->json(['message' => 'Invalid backup format.'], 422);
        }

        try {
            $result = $backup->import($payload);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Import fail: '.$e->getMessage(),
            ], 500);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Database restore ho gaya. Dobara login karo.',
            'data' => $result,
        ]);
    }
}
