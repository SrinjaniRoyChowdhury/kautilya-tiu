import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ALLOWED_PATHS = new Set(["supabase/seed.sql", ".github/workflows/ci.yml"]);

function isAllowed(path) {
  return ALLOWED_PATHS.has(path) || /(^|\/)\.env[^/]*\.example$/.test(path);
}

const FORBIDDEN_PATH = [
  /(^|\/)\.env(?!.*\.example$)/,
  /(^|\/)\.env\.[^/]+$/,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|\/)id_rsa$/,
  /(^|\/)id_ed25519$/,
  /(^|\/)credentials\.json$/,
  /serviceAccount.*\.json$/i,
  /(^|\/)\.secrets(\/|$)/,
];

const FORBIDDEN_CONTENT = [
  { name: "private key", re: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/ },
  { name: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/ },
  { name: "GitHub PAT", re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: "Stripe live key", re: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

function gitList(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "git list failed\n");
    process.exit(result.status ?? 1);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const tracked = gitList(["ls-files"]);
const staged = gitList(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
const files = [...new Set([...tracked, ...staged])];

const problems = [];

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  if (isAllowed(normalized)) continue;
  if (FORBIDDEN_PATH.some((re) => re.test(normalized))) {
    problems.push(`${normalized}: secret-like filename must not be committed`);
    continue;
  }
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const rule of FORBIDDEN_CONTENT) {
    if (rule.re.test(text)) {
      problems.push(`${normalized}: looks like a ${rule.name}`);
    }
  }
}

if (problems.length) {
  process.stderr.write("Secret check failed:\n");
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  process.exit(1);
}

console.log(`Secret check passed (${files.length} files).`);
