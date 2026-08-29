/** React Bits CurvedLoop separator between marquee segments. */
export const RIBBON_ANNOUNCEMENT_SEPARATOR = " ✦ ";

export function buildAnnouncementMarqueeText(titles: string[]) {
  const items = titles.map((title) => title.trim()).filter(Boolean);
  if (!items.length) return "";
  return `${items.join(RIBBON_ANNOUNCEMENT_SEPARATOR)} ✦`;
}

export function announcementFingerprint(items: { id: string; title: string }[]) {
  return items.map((item) => `${item.id}:${item.title.trim()}`).join("|");
}
