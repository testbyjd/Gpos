<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_log', function (Blueprint $table) {
            $table->id();
            $table->string('device_id', 64);
            $table->uuid('client_id');
            $table->string('entity_type', 30)->default('sale');
            $table->string('status', 30); // created, already_synced, failed
            $table->unsignedBigInteger('server_id')->nullable();
            $table->json('payload')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['device_id', 'created_at']);
            $table->unique(['client_id', 'entity_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_log');
    }
};
