const base = process.env.SMOKE_URL ?? "http://localhost:3000";
const paths = ["/", "/about", "/api/health", "/api/ready", "/gallery"];

async function hit(path) {
  const started = Date.now();
  const res = await fetch(`${base}${path}`);
  const ms = Date.now() - started;
  return { path, status: res.status, ms };
}

const rows = [];
for (const path of paths) {
  rows.push(await hit(path));
}
console.table(rows);
const failed = rows.filter((row) => row.status >= 500 || row.ms > 5000);
if (failed.length) {
  console.error("Smoke failed", failed);
  process.exit(1);
}
