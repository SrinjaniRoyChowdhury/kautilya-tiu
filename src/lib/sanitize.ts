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

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function toPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
      if (entity[0] === "#") {
        const hex = entity[1] === "x" || entity[1] === "X";
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      return ENTITIES[entity.toLowerCase()] ?? "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
