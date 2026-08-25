const SCRIPTISH = /<(script|iframe|object|embed|link|meta|style|form)\b[^>]*>[\s\S]*?<\/\1>/gi;
const SCRIPTISH_VOID = /<(script|iframe|object|embed|link|meta|style|form|base)\b[^>]*\/?>/gi;
const ON_ATTR = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi;
const DATA_HTML = /\s(href|src)\s*=\s*(['"])\s*data:text\/html[^'"]*\2/gi;

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(SCRIPTISH, "")
    .replace(SCRIPTISH_VOID, "")
    .replace(ON_ATTR, "")
    .replace(JS_URL, "")
    .replace(DATA_HTML, "");
}
