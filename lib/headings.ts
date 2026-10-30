export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/** Same ids the published page assigns to H1–H3, so search links scroll to the heading. */
export function slugifyHeading(text: string, index: number) {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-$/g, "")
    .slice(0, 48);
  return `${base || "heading"}-${index}`;
}

export function headingPlainText(inner: string) {
  return inner
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function extractTocFromHtml(html: string): TocItem[] {
  const items: TocItem[] = [];
  const used = new Set<string>();
  const re = /<h([1-3])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(html))) {
    const text = headingPlainText(match[2]);
    let id = slugifyHeading(text, index);
    if (used.has(id)) id = `${id}-${index}`;
    used.add(id);
    items.push({ id, text, level: Number(match[1]) });
    index += 1;
  }
  return items;
}
