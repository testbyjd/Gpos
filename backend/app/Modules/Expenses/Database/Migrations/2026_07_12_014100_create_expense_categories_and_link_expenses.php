<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['store_id', 'name']);
        });

        $defaults = [
            'utilities' => 'Utilities (bijli/gas/water)',
            'rent' => 'Rent',
            'salary' => 'Salary / wages',
            'transport' => 'Transport',
            'food' => 'Food / tea',
            'maintenance' => 'Maintenance',
            'packaging' => 'Packaging',
            'misc' => 'Misc',
        ];

        $now = now();
        foreach ($defaults as $name) {
            DB::table('expense_categories')->insert([
                'store_id' => null,
                'name' => $name,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('store_id')->constrained('expense_categories')->restrictOnDelete();
        });

        $slugToName = $defaults;
        $nameToId = DB::table('expense_categories')->pluck('id', 'name');

        foreach (DB::table('expenses')->select('id', 'category')->get() as $row) {
            $slug = (string) $row->category;
            $name = $slugToName[$slug] ?? 'Misc';
            $categoryId = $nameToId[$name] ?? $nameToId['Misc'];
            DB::table('expenses')->where('id', $row->id)->update(['category_id' => $categoryId]);
        }

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('category', 40)->nullable()->after('store_id');
        });

        $idToSlug = [
            'Utilities (bijli/gas/water)' => 'utilities',
            'Rent' => 'rent',
            'Salary / wages' => 'salary',
            'Transport' => 'transport',
            'Food / tea' => 'food',
            'Maintenance' => 'maintenance',
            'Packaging' => 'packaging',
            'Misc' => 'misc',
        ];

        $rows = DB::table('expenses')
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.category_id')
            ->select('expenses.id', 'expense_categories.name')
            ->get();

        foreach ($rows as $row) {
            DB::table('expenses')->where('id', $row->id)->update([
                'category' => $idToSlug[$row->name] ?? 'misc',
            ]);
        }

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
        });

        Schema::dropIfExists('expense_categories');
    }
};
