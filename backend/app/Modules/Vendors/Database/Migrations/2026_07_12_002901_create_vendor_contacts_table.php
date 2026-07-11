<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendor_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('role', 40); // salesperson, delivery, accounts, owner, other
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['vendor_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_contacts');
    }
};
