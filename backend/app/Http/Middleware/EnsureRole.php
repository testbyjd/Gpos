<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to the given roles (RBAC).
 *
 * Usage: ->middleware('role:owner,manager')
 * Cashiers are intentionally excluded from cost prices, reports,
 * inventory edits, vendors/purchases and user management (see plan §4.5).
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, $roles, true)) {
            abort(403, 'This action requires elevated privileges.');
        }

        return $next($request);
    }
}
