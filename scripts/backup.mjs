import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = `backups/kautilya-${stamp}.sql`;
const result = spawnSync("npx", ["supabase", "db", "dump", "-f", file], {
  stdio: "inherit",
  shell: true,
});
if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}
console.log(`Wrote ${file}`);
