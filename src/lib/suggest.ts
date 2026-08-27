export function filterByTypedName<T extends { name: string }>(
  items: T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    if (name.startsWith(q)) starts.push(item);
    else if (q.length > 1 && name.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}

export function exactNameMatch<T extends { name: string }>(items: T[], query: string): T | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return items.find((item) => item.name.toLowerCase() === q) ?? null;
}
