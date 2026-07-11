<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Customers\Models\Customer;
use App\Support\DatabaseBackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseBackupTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_export_backup_json(): void
    {
        $owner = User::factory()->owner()->create();
        Customer::query()->create([
            'store_id' => $owner->store_id,
            'name' => 'Backup Customer',
            'phone' => '03001234567',
            'balance' => 0,
        ]);

        $response = $this->actingAs($owner)->get('/api/v1/settings/backup/export');

        $response->assertOk();
        $payload = json_decode($response->streamedContent(), true);

        $this->assertSame(DatabaseBackupService::FORMAT, $payload['format']);
        $this->assertSame(1, $payload['version']);
        $this->assertArrayHasKey('customers', $payload['tables']);
        $this->assertGreaterThanOrEqual(1, count($payload['tables']['customers']));
    }

    public function test_cashier_cannot_export_backup(): void
    {
        $cashier = User::factory()->create();

        $this->actingAs($cashier)
            ->get('/api/v1/settings/backup/export')
            ->assertForbidden();
    }

    public function test_owner_can_import_backup_with_confirm(): void
    {
        $owner = User::factory()->owner()->create([
            'email' => 'owner@gondal.local',
        ]);

        Customer::query()->create([
            'store_id' => $owner->store_id,
            'name' => 'Keep Me',
            'phone' => '03001111111',
            'balance' => 0,
        ]);

        $export = $this->actingAs($owner)->get('/api/v1/settings/backup/export');
        $json = $export->streamedContent();

        Customer::query()->create([
            'store_id' => $owner->store_id,
            'name' => 'Should Vanish',
            'phone' => '03002222222',
            'balance' => 0,
        ]);
        $this->assertSame(2, Customer::query()->count());

        $file = UploadedFile::fake()->createWithContent('backup.json', $json);

        $this->actingAs($owner)
            ->post('/api/v1/settings/backup/import', [
                'confirm' => 'RESTORE',
                'file' => $file,
            ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertSame(1, Customer::query()->count());
        $this->assertSame('Keep Me', Customer::query()->first()->name);
        $this->assertTrue(User::query()->where('email', 'owner@gondal.local')->exists());
        $this->assertSame(0, DB::table('personal_access_tokens')->count());
    }

    public function test_import_rejects_wrong_confirm(): void
    {
        $owner = User::factory()->owner()->create();
        $payload = app(DatabaseBackupService::class)->export();
        $file = UploadedFile::fake()->createWithContent(
            'backup.json',
            json_encode($payload, JSON_THROW_ON_ERROR),
        );

        $this->actingAs($owner)
            ->post('/api/v1/settings/backup/import', [
                'confirm' => 'yes',
                'file' => $file,
            ])
            ->assertStatus(422);
    }

    public function test_restore_does_not_break_subsequent_inserts(): void
    {
        $owner = User::factory()->owner()->create();
        Customer::query()->create([
            'store_id' => $owner->store_id,
            'name' => 'Seq Probe',
            'phone' => '03009999999',
            'balance' => 0,
        ]);

        $export = $this->actingAs($owner)->get('/api/v1/settings/backup/export');
        $file = UploadedFile::fake()->createWithContent('backup.json', $export->streamedContent());

        $this->actingAs($owner)
            ->post('/api/v1/settings/backup/import', [
                'confirm' => 'RESTORE',
                'file' => $file,
            ])
            ->assertOk();

        // A normal insert relying on the DB-generated id must not collide with a
        // restored row's id (regression guard for the Postgres sequence-reset bug).
        Customer::query()->create([
            'store_id' => $owner->store_id,
            'name' => 'Post Restore Insert',
            'phone' => '03008888888',
            'balance' => 0,
        ]);

        $this->assertSame(2, Customer::query()->count());
    }

    public function test_import_rejects_backup_missing_users(): void
    {
        $owner = User::factory()->owner()->create();
        $payload = app(DatabaseBackupService::class)->export();
        unset($payload['tables']['users']);

        $file = UploadedFile::fake()->createWithContent(
            'backup.json',
            json_encode($payload, JSON_THROW_ON_ERROR),
        );

        $this->actingAs($owner)
            ->post('/api/v1/settings/backup/import', [
                'confirm' => 'RESTORE',
                'file' => $file,
            ])
            ->assertStatus(422);

        // Nothing was wiped — owner account must still be intact.
        $this->assertTrue(User::query()->where('id', $owner->id)->exists());
    }

    public function test_import_failure_rolls_back_completely(): void
    {
        $owner = User::factory()->owner()->create();
        Customer::query()->create([
            'store_id' => $owner->store_id,
            'name' => 'Should Survive',
            'phone' => '03007777777',
            'balance' => 0,
        ]);

        $payload = app(DatabaseBackupService::class)->export();
        // Duplicate a customer row's id so the bulk insert hits a primary-key conflict
        // partway through the restore, simulating a corrupt/bad backup file.
        $customers = $payload['tables']['customers'];
        $payload['tables']['customers'][] = $customers[0];

        $file = UploadedFile::fake()->createWithContent(
            'backup.json',
            json_encode($payload, JSON_THROW_ON_ERROR),
        );

        $this->actingAs($owner)
            ->post('/api/v1/settings/backup/import', [
                'confirm' => 'RESTORE',
                'file' => $file,
            ])
            ->assertStatus(500);

        // Transaction must have rolled back — original data untouched, nothing wiped.
        $this->assertSame(1, Customer::query()->count());
        $this->assertSame('Should Survive', Customer::query()->first()->name);
        $this->assertTrue(User::query()->where('id', $owner->id)->exists());
    }
}
