<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category', 40);
            $table->decimal('amount', 12, 2);
            $table->string('payment_method', 40)->default('cash');
            $table->date('spent_on');
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['spent_on', 'category']);
            $table->index('store_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
