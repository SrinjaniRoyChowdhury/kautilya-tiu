#!/usr/bin/env node
/**
 * Run docker compose for production using .env.production (or .env fallback).
 * Ensures NEXT_PUBLIC_* build args are available to app-prod.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const envFile = existsSync(resolve(cwd, ".env.production"))
  ? ".env.production"
  : ".env";

if (!existsSync(resolve(cwd, envFile))) {
  console.error(
    "Missing .env.production (or .env). Copy .env.production.example and fill values.",
  );
  process.exit(1);
}

const args = [
  "compose",
  "--env-file",
  envFile,
  "--profile",
  "prod",
  ...process.argv.slice(2),
];

if (!args.includes("app-prod") && (args.includes("up") || args.includes("run"))) {
  args.push("app-prod");
}

const result = spawnSync("docker", args, { stdio: "inherit", cwd });
process.exit(result.status ?? 1);
