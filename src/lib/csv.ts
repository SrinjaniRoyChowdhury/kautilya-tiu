export function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export function safeCsvFilename(filename: string): string {
  const base = filename.replace(/[^\w.\-]+/g, "_").replace(/^[._]+/, "") || "report.csv";
  return base.slice(0, 80);
}

export function csvResponse(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const safe = safeCsvFilename(filename);
  return new Response(toCsv(headers, rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${safe}"`,
      "cache-control": "no-store",
    },
  });
}
