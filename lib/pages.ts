import { db, CollectionRow, PageRow } from "./db";
import { clampSearchLimit, contentTerms, ftsMatchQuery, snippetAround, termCoverage } from "./search-index";

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

export interface SearchHit {
  id: number;
  title: string;
  section: string;
  anchor: string;
  snippet: string;
  score: number;
  href: string;
  updated_at: string;
  collection_id: number;
  collection_slug: string;
  collection_name: string;
}

export interface SearchOptions {
  /** Collection name, slug, or numeric id. */
  collection?: string | number | null;
  /** Defaults to 5. Values above 20 are capped. */
  limit?: number | null;
}

export function toPublicSearchHit(hit: SearchHit) {
  return {
    id: hit.id,
    title: hit.title,
    section: hit.section,
    anchor: hit.anchor,
    collection: hit.collection_name,
    href: hit.href,
    snippet: hit.snippet,
    score: hit.score,
    updated_at: hit.updated_at,
  };
}

function collectionFilter(collection: string | number | null | undefined): { sql: string; params: Array<string | number> } {
  if (collection == null) return { sql: "", params: [] };
  const raw = String(collection).trim();
  if (!raw) return { sql: "", params: [] };
  const id = /^\d+$/.test(raw) ? Number(raw) : -1;
  return {
    sql: "AND (c.id = ? OR c.name = ? COLLATE NOCASE OR c.slug = ? COLLATE NOCASE)",
    params: [id, raw, raw],
  };
}

interface SearchRow {
  id: number;
  title: string;
  updated_at: string;
  collection_id: number;
  collection_slug: string;
  collection_name: string;
  section_heading: string;
  section_anchor: string;
  section_text: string;
  raw_rank: number;
}

/**
 * Published pages only. A query matches when any keyword hits, stop words are
 * ignored, and each hit is the best section on that page (at most two per page).
 */
export function searchPages(q: string, options: SearchOptions = {}): SearchHit[] {
  const terms = contentTerms(q);
  const match = ftsMatchQuery(q);
  if (!match) return [];
  const limit = clampSearchLimit(options.limit);
  const collection = collectionFilter(options.collection);
  let rows: SearchRow[];
  try {
    rows = db
      .prepare(
        `SELECT p.id, p.title, p.updated_at, p.collection_id,
                c.slug AS collection_slug, c.name AS collection_name,
                page_search.heading AS section_heading,
                page_search.anchor AS section_anchor,
                page_search.body AS section_text,
                bm25(page_search) AS raw_rank
         FROM page_search
         JOIN pages p ON p.id = CAST(page_search.page_id AS INTEGER)
         JOIN collections c ON c.id = p.collection_id
         WHERE page_search MATCH ?
           AND p.status = 'published'
           ${collection.sql}
         ORDER BY raw_rank ASC, p.updated_at DESC
         LIMIT 200`
      )
      .all(match, ...collection.params) as unknown as SearchRow[];
  } catch {
    return [];
  }

  const pagesByCollection = new Map<number, PageRow[]>();
  const ranked = rows.map((row) => {
    const coverage = termCoverage(`${row.title}\n${row.section_heading}\n${row.section_text}`, terms);
    const magnitude = Number.isFinite(row.raw_rank) ? Math.abs(row.raw_rank) : 0;
    const score = Math.round((coverage * 100 + magnitude) * 1000) / 1000;
    return { row, score };
  });
  ranked.sort((a, b) => b.score - a.score || b.row.updated_at.localeCompare(a.row.updated_at));

  const hits: SearchHit[] = [];
  const perPage = new Map<number, number>();
  for (const { row, score } of ranked) {
    const seen = perPage.get(row.id) ?? 0;
    if (seen >= 2) continue;
    perPage.set(row.id, seen + 1);
    let pages = pagesByCollection.get(row.collection_id);
    if (!pages) {
      pages = getCollectionPages(row.collection_id);
      pagesByCollection.set(row.collection_id, pages);
    }
    const anchor = row.section_anchor || "intro";
    const href = `${hrefForPage(row.collection_slug, pages, row.id)}#${anchor}`;
    hits.push({
      id: row.id,
      title: row.title,
      section: row.section_heading || "",
      anchor,
      snippet: snippetAround(row.section_text, q),
      score,
      href,
      updated_at: row.updated_at,
      collection_id: row.collection_id,
      collection_slug: row.collection_slug,
      collection_name: row.collection_name,
    });
    if (hits.length >= limit) break;
  }
  return hits;
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
