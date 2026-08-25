import { inflateRawSync } from "node:zlib";

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toSpreadsheetXml(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  sheetName = "Sheet1",
): string {
  const all = [headers, ...rows];
  const body = all
    .map((row) => {
      const cells = row
        .map((cell) => {
          const text = cell == null ? "" : String(cell);
          const number = typeof cell === "number" && Number.isFinite(cell);
          return `<Cell><Data ss:Type="${number ? "Number" : "String"}">${xmlEscape(text)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xmlEscape(sheetName)}"><Table>${body}</Table></Worksheet>
</Workbook>
`;
}

export function spreadsheetResponse(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  sheetName = "Sheet1",
) {
  const safe = filename.replace(/[^\w.\-]+/g, "_").replace(/^[._]+/, "") || "report.xls";
  return new Response(toSpreadsheetXml(headers, rows, sheetName), {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${safe.slice(0, 80)}"`,
      "cache-control": "no-store",
    },
  });
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b) {
    if (bytes[offset + 2] !== 0x03 || bytes[offset + 3] !== 0x04) break;
    const method = readU16(bytes, offset + 8);
    const compact = readU32(bytes, offset + 18);
    const raw = readU32(bytes, offset + 22);
    const nameLen = readU16(bytes, offset + 26);
    const extraLen = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const name = decodeUtf8(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const stored = bytes.subarray(dataStart, dataStart + compact);
    let out: Uint8Array;
    if (method === 0) out = stored;
    else if (method === 8) out = new Uint8Array(inflateRawSync(Buffer.from(stored), { maxOutputLength: Math.max(raw, 1) }));
    else throw new Error("Unsupported zip compression");
    files.set(name, out);
    offset = dataStart + compact;
  }
  return files;
}

function xmlTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) out.push(match[1] ?? "");
  return out;
}

function xmlAttr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function colIndex(cellRef: string): number {
  const letters = cellRef.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

function parseXlsxSheet(bytes: Uint8Array): string[][] {
  const files = unzip(bytes);
  const sharedXml = decodeUtf8(files.get("xl/sharedStrings.xml") ?? new Uint8Array());
  const strings = xmlTags(sharedXml, "si").map((si) =>
    xmlTags(si, "t")
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join(""),
  );
  const sheet =
    decodeUtf8(files.get("xl/worksheets/sheet1.xml") ?? new Uint8Array()) ||
    decodeUtf8([...files.entries()].find(([name]) => name.startsWith("xl/worksheets/sheet"))?.[1] ?? new Uint8Array());
  const rows: string[][] = [];
  for (const rowXml of xmlTags(sheet, "row")) {
    const line: string[] = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(rowXml))) {
      const attrs = cell[1] ?? cell[3] ?? "";
      const inner = cell[2] ?? "";
      const ref = xmlAttr(attrs, "r") ?? "";
      const type = xmlAttr(attrs, "t");
      const idx = colIndex(ref || "A");
      while (line.length < idx) line.push("");
      let value = "";
      if (type === "s") {
        const v = xmlTags(inner, "v")[0];
        value = strings[Number(v)] ?? "";
      } else if (type === "inlineStr") {
        value = xmlTags(inner, "t").join("");
      } else {
        value = xmlTags(inner, "v")[0] ?? inner.replace(/<[^>]+>/g, "").trim();
      }
      line[idx] = value.trim();
    }
    if (line.some((cell) => cell)) rows.push(line);
  }
  return rows;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  const body = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t") {
      row.push(cur.trim());
      cur = "";
    } else if (ch === "\n") {
      row.push(cur.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") cur += ch;
  }
  row.push(cur.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function looksLikeSpreadsheetXml(bytes: Uint8Array): boolean {
  const head = decodeUtf8(bytes.subarray(0, 240)).replace(/^\uFEFF/, "");
  return head.includes("Excel.Sheet") || head.includes("urn:schemas-microsoft-com:office:spreadsheet");
}

function parseSpreadsheetXml(xml: string): string[][] {
  const rows: string[][] = [];
  for (const rowXml of xmlTags(xml, "Row")) {
    const line: string[] = [];
    for (const cellXml of xmlTags(rowXml, "Cell")) {
      const data = xmlTags(cellXml, "Data")[0] ?? cellXml.replace(/<[^>]+>/g, "");
      line.push(data.replace(/<[^>]+>/g, "").trim());
    }
    if (line.some(Boolean)) rows.push(line);
  }
  return rows;
}

export function parseTabularFile(bytes: Uint8Array): string[][] {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return parseXlsxSheet(bytes);
  if (looksLikeSpreadsheetXml(bytes)) return parseSpreadsheetXml(decodeUtf8(bytes));
  return parseCsv(decodeUtf8(bytes));
}

export function parsePortfoliosText(raw: string): PortfolioRow[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      return normalizePortfolios(JSON.parse(text));
    } catch {
      /* fall through to tabular parse */
    }
  }
  return parsePortfolioMatrix(new TextEncoder().encode(text.replaceAll("|", "\t")));
}

function normHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function columnIndex(headers: string[], aliases: string[]): number {
  const want = aliases.map(normHeader);
  return headers.findIndex((h) => want.includes(normHeader(h)));
}

export type PortfolioRow = { slr: number; name: string };

export function parsePortfolioMatrix(bytes: Uint8Array): PortfolioRow[] {
  const table = parseTabularFile(bytes);
  if (!table.length) return [];
  const headers = table[0] ?? [];
  let slrIdx = columnIndex(headers, ["slr", "slrno", "slno", "sno", "number", "no", "sl"]);
  let nameIdx = columnIndex(headers, ["portfolio", "delegation", "country", "name"]);
  const data = table.slice(slrIdx >= 0 || nameIdx >= 0 ? 1 : 0);
  if (slrIdx < 0) slrIdx = 0;
  if (nameIdx < 0) nameIdx = Math.min(1, (data[0]?.length ?? 1) - 1);
  const rows: PortfolioRow[] = [];
  for (const line of data) {
    const name = String(line[nameIdx] ?? "").trim();
    if (!name) continue;
    const slrRaw = Number(String(line[slrIdx] ?? "").replace(/[^\d]/g, ""));
    rows.push({ slr: Number.isFinite(slrRaw) && slrRaw > 0 ? slrRaw : rows.length + 1, name });
  }
  return rows;
}

export function normalizePortfolios(raw: unknown): PortfolioRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (typeof item === "string") return { slr: index + 1, name: item.trim() };
      if (!item || typeof item !== "object") return null;
      const rec = item as { slr?: unknown; name?: unknown };
      const name = String(rec.name ?? "").trim();
      if (!name) return null;
      const slr = Number(rec.slr);
      return { slr: Number.isFinite(slr) && slr > 0 ? slr : index + 1, name };
    })
    .filter((row): row is PortfolioRow => Boolean(row));
}
