#!/usr/bin/env node
/**
 * Next.js "standalone" output does not include .next/static or public/.
 * Without this step, production returns 500 for JS/CSS chunks → stuck on "Checking session...".
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next/standalone");

if (!existsSync(standalone)) {
  console.error("[prepare-standalone] Missing .next/standalone — run `npm run build` first.");
  process.exit(1);
}

cpSync(join(root, ".next/static"), join(standalone, ".next/static"), { recursive: true });
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });

console.log("[prepare-standalone] Copied .next/static and public into standalone bundle.");
