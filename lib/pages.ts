import { db, CollectionRow, PageRow } from "./db";

export interface PageWithEditor extends PageRow {
  editor_name?: string;
}

export function getCollections(): CollectionRow[] {
  return db
    .prepare("SELECT * FROM collections ORDER BY position, name")
    .all() as unknown as CollectionRow[];
}

export function getCollectionBySlug(slug: string): CollectionRow | undefined {
  return db.prepare("SELECT * FROM collections WHERE slug = ?").get(slug) as unknown as
    | CollectionRow
    | undefined;
}

/** All pages of a collection ordered for tree rendering. */
export function getCollectionPages(collectionId: number): PageRow[] {
  return db
    .prepare("SELECT * FROM pages WHERE collection_id = ? ORDER BY position, title")
    .all(collectionId) as unknown as PageRow[];
}

export interface TreeNode {
  page: PageRow;
  children: TreeNode[];
}

/** Build a nested tree from a flat page list (roots = parent_id null). */
export function buildTree(pages: PageRow[]): TreeNode[] {
  const byParent = new Map<number | null, PageRow[]>();
  for (const p of pages) {
    const key = p.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(p);
  }
  const make = (parentId: number | null): TreeNode[] =>
    (byParent.get(parentId) || []).map((page) => ({ page, children: make(page.id) }));
  return make(null);
}

/** Resolve /catalogue/<collection>/<slug>/<slug>... to a page. */
export function resolvePath(
  path: string[]
): { collection: CollectionRow; page: PageRow; ancestors: PageRow[] } | null {
  if (path.length < 2) return null;
  const collection = getCollectionBySlug(path[0]);
  if (!collection) return null;

  const pages = getCollectionPages(collection.id);
  let parentId: number | null = null;
  const ancestors: PageRow[] = [];
  let found: PageRow | undefined;

  for (const slug of path.slice(1)) {
    found = pages.find((p) => p.slug === slug && (p.parent_id ?? null) === parentId);
    if (!found) return null;
    ancestors.push(found);
    parentId = found.id;
  }
  return { collection, page: found!, ancestors: ancestors.slice(0, -1) };
}

export function pageHref(collectionSlug: string, ancestors: PageRow[], page: PageRow): string {
  const slugs = [...ancestors.map((a) => a.slug), page.slug];
  return `/catalogue/${collectionSlug}/${slugs.join("/")}`;
}

/** href for a page given only its id (walks parents). */
export function hrefForPage(collectionSlug: string, pages: PageRow[], pageId: number): string {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const chain: PageRow[] = [];
  let cur = byId.get(pageId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return `/catalogue/${collectionSlug}/${chain.map((p) => p.slug).join("/")}`;
}

/** Recently updated published pages across all collections. */
export function getRecentPages(limit = 6): Array<PageRow & { collection_slug: string; collection_name: string }> {
  return db
    .prepare(
      `SELECT p.*, c.slug AS collection_slug, c.name AS collection_name
       FROM pages p JOIN collections c ON c.id = p.collection_id
       WHERE p.status = 'published'
       ORDER BY p.updated_at DESC LIMIT ?`
    )
    .all(limit) as unknown as Array<PageRow & { collection_slug: string; collection_name: string }>;
}

export function countPages(collectionId: number, publishedOnly = false): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM pages WHERE collection_id = ?${publishedOnly ? " AND status = 'published'" : ""}`)
    .get(collectionId) as unknown as { n: number };
  return row.n;
}

/** First published page of the catalogue (for /catalogue redirect). */
export function firstPublished(): { collection: CollectionRow; page: PageRow } | null {
  const collections = getCollections();
  for (const c of collections) {
    const pages = getCollectionPages(c.id);
    const tree = buildTree(pages);
    const first = tree.find((n) => n.page.status === "published");
    if (first) return { collection: c, page: first.page };
  }
  return null;
}

export function searchPages(q: string): Array<PageRow & {
  collection_slug: string;
  collection_name: string;
  search_snippet?: string;
}> {
  const terms = q.match(/[\p{L}\p{N}_-]+/gu)?.slice(0, 10) || [];
  if (terms.length === 0) return [];
  const match = terms.map((term) => `"${term.replace(/"/g, "")}"*`).join(" AND ");
  return db
    .prepare(
      `SELECT p.*, c.slug AS collection_slug, c.name AS collection_name,
              snippet(page_search, 2, '', '', ' … ', 28) AS search_snippet
       FROM page_search
       JOIN pages p ON p.id = CAST(page_search.page_id AS INTEGER)
       JOIN collections c ON c.id = p.collection_id
       WHERE page_search MATCH ? AND p.status = 'published'
       ORDER BY bm25(page_search, 8.0, 3.0), p.updated_at DESC LIMIT 30`
    )
    .all(match) as unknown as Array<PageRow & { collection_slug: string; collection_name: string; search_snippet?: string }>;
}

/** Strip tags for search snippets. */
export function textSnippet(html: string, q: string, width = 160): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, width);
  const start = Math.max(0, idx - 60);
  return (start > 0 ? "…" : "") + text.slice(start, start + width) + "…";
}

export function timeAgo(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(1, Math.floor((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
