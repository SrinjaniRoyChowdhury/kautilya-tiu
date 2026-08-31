import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Load env files without overriding variables already set in the shell.
 * Later files override earlier ones (.env.local wins over .env locally;
 * .env.production wins over .env on the server).
 */
export function loadEnvFiles(cwd = process.cwd(), { production = false } = {}) {
  const preset = new Set(Object.keys(process.env));
  const files = production
    ? [".env", ".env.production"]
    : [".env", ".env.local"];
  const merged = {};
  for (const name of files) {
    Object.assign(merged, parseEnvFile(resolve(cwd, name)));
  }
  for (const [key, value] of Object.entries(merged)) {
    if (!preset.has(key)) process.env[key] = value;
  }
}
