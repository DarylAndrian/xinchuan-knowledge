import { NextResponse } from "next/server";
import { db, PageRow, CollectionRow, UserRow, Role, recordPageRevision, syncPageSearch, slugify } from "./db";
import { htmlToText, sanitizeWikiHtml } from "./content";
import { getComments } from "./comments";
import { getCollectionPages, getRecentPages, hrefForPage, searchPages } from "./pages";
import { Scope, TokenPrincipal, hasScope } from "./tokens";
import { getSetting, setSetting } from "./db";
import bcrypt from "bcryptjs";
import packageJson from "../package.json";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const SERVER_INFO = {
  name: "xinchuan-knowledge",
  version: packageJson.version,
};

export class McpToolError extends Error {
  status: number;
  constructor(message: string, status = -32000) {
    super(message);
    this.status = status;
  }
}

type ToolHandler = (
  principal: TokenPrincipal,
  args: Record<string, unknown>
) => Promise<unknown> | unknown;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  scope: Scope;
  handler: ToolHandler;
}

function requireScope(principal: TokenPrincipal, scope: Scope): void {
  if (!hasScope(principal, scope)) {
    throw new McpToolError(`Missing scope: ${scope}`);
  }
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function canSeeDrafts(principal: TokenPrincipal): boolean {
  return hasScope(principal, "read:drafts");
}

function pagePayload(page: PageRow, includeContent = false) {
  const collection = db.prepare("SELECT name, slug FROM collections WHERE id = ?").get(page.collection_id) as
    | { name: string; slug: string }
    | undefined;
  const pages = getCollectionPages(page.collection_id);
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    icon: page.icon,
    status: page.status,
    collection_id: page.collection_id,
    collection: collection?.name || "",
    parent_id: page.parent_id,
    href: collection ? hrefForPage(collection.slug, pages, page.id) : null,
    updated_at: page.updated_at,
    ...(includeContent
      ? { content: htmlToText(page.content_html), content_html: page.content_html }
      : {}),
  };
}

function uniqueSlug(collectionId: number, parentId: number | null, base: string): string {
  let slug = base || "untitled";
  let n = 2;
  while (
    db
      .prepare(
        "SELECT id FROM pages WHERE collection_id = ? AND COALESCE(parent_id,0) = COALESCE(?,0) AND slug = ?"
      )
      .get(collectionId, parentId, slug)
  ) {
    slug = `${base || "untitled"}-${n++}`;
  }
  return slug;
}

function nextPosition(collectionId: number, parentId: number | null): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM pages WHERE collection_id = ? AND COALESCE(parent_id,0) = COALESCE(?,0)"
    )
    .get(collectionId, parentId) as { p: number };
  return row.p;
}

function contentFromArgs(args: Record<string, unknown>): { html: string; json: string } {
  const contentHtml = str(args.content_html);
  if (contentHtml) return { html: sanitizeWikiHtml(contentHtml), json: str(args.content_json, "{}") };
  const plain = str(args.content).trim();
  if (!plain) return { html: "", json: "{}" };
  const paragraphs = plain
    .split(/\n{2,}/)
    .map((block) => {
      const escaped = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      return `<p>${escaped}</p>`;
    })
    .join("");
  return { html: sanitizeWikiHtml(paragraphs), json: "{}" };
}

const ROLES: Role[] = ["superadmin", "admin", "commentator", "guest"];

function isSuperadmin(user: TokenPrincipal["user"]): boolean {
  return user.role === "superadmin";
}

function isEditorUser(user: TokenPrincipal["user"]): boolean {
  return user.role === "admin" || user.role === "superadmin";
}

function canCommentAs(user: TokenPrincipal["user"]): boolean {
  return user.role === "commentator" || user.role === "admin" || user.role === "superadmin";
}

const tools: ToolDef[] = [
  {
    name: "search_xinchuan_wiki",
    description: "Search published Xinchuan wiki pages by keyword.",
    scope: "read:content",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["query"],
      additionalProperties: false,
    },
    handler: (_p, args) => {
      const query = str(args.query).trim().slice(0, 200);
      if (!query) return { query, results: [] };
      const results = searchPages(query).map((page) => ({
        id: page.id,
        title: page.title,
        collection: page.collection_name,
        href: hrefForPage(page.collection_slug, getCollectionPages(page.collection_id), page.id),
        snippet: page.search_snippet || "",
        updated_at: page.updated_at,
      }));
      return { query, results };
    },
  },
  {
    name: "read_xinchuan_page",
    description: "Read one wiki page by ID as plain text (and sanitized HTML).",
    scope: "read:content",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "integer", minimum: 1 } },
      required: ["page_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      const pageId = num(args.page_id);
      if (!pageId) throw new McpToolError("page_id is required");
      const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow | undefined;
      if (!page) throw new McpToolError("Page not found", -32001);
      if (page.status !== "published" && !canSeeDrafts(principal)) {
        throw new McpToolError("Draft page requires the read:drafts scope");
      }
      return pagePayload(page, true);
    },
  },
  {
    name: "list_xinchuan_collections",
    description: "List collections with published page counts.",
    scope: "read:content",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (principal) => {
      const includeDrafts = canSeeDrafts(principal);
      const collections = db
        .prepare(
          `SELECT c.id, c.name, c.slug, c.description, c.icon, c.position,
            COUNT(p.id) AS page_count
            FROM collections c
            LEFT JOIN pages p ON p.collection_id = c.id${includeDrafts ? "" : " AND p.status = 'published'"}
            GROUP BY c.id
            ORDER BY c.position, c.name`
        )
        .all();
      return { collections };
    },
  },
  {
    name: "recent_xinchuan_updates",
    description: "List recently updated published pages.",
    scope: "read:content",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
      additionalProperties: false,
    },
    handler: (principal, args) => {
      const requested = num(args.limit, 10) ?? 10;
      const limit = Math.min(50, Math.max(1, Math.floor(requested)));
      type RecentRow = PageRow & { collection_slug: string; collection_name: string };
      let rows: RecentRow[] = getRecentPages(limit);
      if (canSeeDrafts(principal)) {
        rows = db
          .prepare(
            `SELECT p.*, c.slug AS collection_slug, c.name AS collection_name
             FROM pages p JOIN collections c ON c.id = p.collection_id
             ORDER BY p.updated_at DESC LIMIT ?`
          )
          .all(limit) as unknown as RecentRow[];
      }
      return {
        pages: rows.map((page) => ({
          id: page.id,
          title: page.title,
          status: page.status,
          collection: page.collection_name,
          href: hrefForPage(page.collection_slug, getCollectionPages(page.collection_id), page.id),
          updated_at: page.updated_at,
        })),
      };
    },
  },
  {
    name: "list_xinchuan_pages",
    description: "List pages in a collection (tree order). Includes drafts when the token has read:drafts.",
    scope: "read:content",
    inputSchema: {
      type: "object",
      properties: { collection_id: { type: "integer", minimum: 1 } },
      required: ["collection_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      const collectionId = num(args.collection_id);
      if (!collectionId) throw new McpToolError("collection_id is required");
      const pages = getCollectionPages(collectionId).filter(
        (p) => p.status === "published" || canSeeDrafts(principal)
      );
      return { pages: pages.map((p) => pagePayload(p)) };
    },
  },
  {
    name: "create_xinchuan_page",
    description: "Create a page in a collection. Content may be plain text or HTML.",
    scope: "write:content",
    inputSchema: {
      type: "object",
      properties: {
        collection_id: { type: "integer", minimum: 1 },
        title: { type: "string", minLength: 1 },
        parent_id: { type: "integer", minimum: 1 },
        content: { type: "string", description: "Plain text content (paragraphs separated by blank lines)." },
        content_html: { type: "string", description: "Sanitized wiki HTML (preferred if both provided)." },
        status: { type: "string", enum: ["draft", "published"] },
      },
      required: ["collection_id", "title"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isEditorUser(principal.user)) throw new McpToolError("Editor role required for page writes");
      const collectionId = num(args.collection_id);
      const title = str(args.title).trim() || "Untitled";
      if (!collectionId) throw new McpToolError("collection_id is required");
      if (!db.prepare("SELECT id FROM collections WHERE id = ?").get(collectionId)) {
        throw new McpToolError("Collection not found", -32001);
      }
      const parentId = num(args.parent_id);
      if (parentId) {
        const parent = db.prepare("SELECT collection_id FROM pages WHERE id = ?").get(parentId) as
          | { collection_id: number }
          | undefined;
        if (!parent || parent.collection_id !== collectionId) {
          throw new McpToolError("Parent page must belong to this collection");
        }
      }
      const slug = uniqueSlug(collectionId, parentId, slugify(title));
      const position = nextPosition(collectionId, parentId);
      const content = contentFromArgs(args);
      const status = args.status === "published" ? "published" : "draft";
      const info = db
        .prepare(
          "INSERT INTO pages (collection_id, parent_id, title, slug, content_json, content_html, status, position, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(collectionId, parentId, title, slug, content.json, content.html, status, position, principal.user.id);
      const pageId = Number(info.lastInsertRowid);
      recordPageRevision(pageId, principal.user.id, true);
      syncPageSearch(pageId);
      const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow;
      return pagePayload(page, true);
    },
  },
  {
    name: "update_xinchuan_page",
    description: "Update a page: title, slug, content, status, parent, or collection.",
    scope: "write:content",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "integer", minimum: 1 },
        title: { type: "string" },
        slug: { type: "string" },
        content: { type: "string" },
        content_html: { type: "string" },
        status: { type: "string", enum: ["draft", "published"] },
        parent_id: { type: ["integer", "null"] },
        collection_id: { type: "integer" },
      },
      required: ["page_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isEditorUser(principal.user)) throw new McpToolError("Editor role required for page writes");
      const pageId = num(args.page_id);
      if (!pageId) throw new McpToolError("page_id is required");
      const existing = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow | undefined;
      if (!existing) throw new McpToolError("Page not found", -32001);

      const targetCollectionId =
        typeof args.collection_id === "number" ? args.collection_id : existing.collection_id;
      const targetParentId =
        args.parent_id === null ? null : args.parent_id !== undefined ? num(args.parent_id) : existing.parent_id;

      if (!db.prepare("SELECT id FROM collections WHERE id = ?").get(targetCollectionId)) {
        throw new McpToolError("Collection not found", -32001);
      }
      if (targetParentId === pageId) throw new McpToolError("A page cannot be its own parent");
      if (targetParentId) {
        const parent = db.prepare("SELECT collection_id FROM pages WHERE id = ?").get(targetParentId) as
          | { collection_id: number }
          | undefined;
        if (!parent || parent.collection_id !== targetCollectionId) {
          throw new McpToolError("Parent page must belong to the selected collection");
        }
        const cycle = db
          .prepare(
            `WITH RECURSIVE descendants(id) AS (
              SELECT id FROM pages WHERE parent_id = ?
              UNION ALL SELECT p.id FROM pages p JOIN descendants d ON p.parent_id = d.id
            ) SELECT id FROM descendants WHERE id = ? LIMIT 1`
          )
          .get(pageId, targetParentId);
        if (cycle) throw new McpToolError("That move would create a page cycle");
      }

      const sets: string[] = [];
      const values: (string | number | null)[] = [];
      const slugTaken = (slug: string) =>
        db
          .prepare(
            "SELECT id FROM pages WHERE collection_id = ? AND COALESCE(parent_id,0) = COALESCE(?,0) AND slug = ? AND id != ?"
          )
          .get(targetCollectionId, targetParentId, slug);

      const slugProvided = typeof args.slug === "string";
      if (slugProvided) {
        const slug = slugify(str(args.slug).trim());
        if (!slug) throw new McpToolError("Slug can't be empty");
        if (slugTaken(slug)) throw new McpToolError("That slug is already used by another page here");
        sets.push("slug = ?");
        values.push(slug);
      }
      if (typeof args.title === "string") {
        const title = args.title.trim() || "Untitled";
        sets.push("title = ?");
        values.push(title);
        if (!slugProvided && title !== existing.title && existing.slug === slugify(existing.title)) {
          const base = slugify(title);
          let slug = base;
          let n = 2;
          while (slugTaken(slug)) slug = `${base}-${n++}`;
          sets.push("slug = ?");
          values.push(slug);
        }
      }
      if (typeof args.content_html === "string" || typeof args.content === "string") {
        const content = contentFromArgs(args);
        sets.push("content_html = ?", "content_json = ?");
        values.push(content.html, content.json);
      }
      if (args.status === "draft" || args.status === "published") {
        sets.push("status = ?");
        values.push(args.status);
      }
      if (args.parent_id !== undefined) {
        sets.push("parent_id = ?");
        values.push(targetParentId);
      }
      if (typeof args.collection_id === "number") {
        sets.push("collection_id = ?");
        values.push(targetCollectionId);
      }
      if (sets.length === 0) throw new McpToolError("Nothing to update");
      sets.push("updated_at = datetime('now')", "updated_by = ?");
      values.push(principal.user.id, pageId);
      db.prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      const force = Boolean(args.status && args.status !== existing.status);
      recordPageRevision(pageId, principal.user.id, force);
      syncPageSearch(pageId);
      const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow;
      return pagePayload(page, true);
    },
  },
  {
    name: "delete_xinchuan_page",
    description: "Delete a page and its descendants (cascading).",
    scope: "write:content",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "integer", minimum: 1 } },
      required: ["page_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isEditorUser(principal.user)) throw new McpToolError("Editor role required for page writes");
      const pageId = num(args.page_id);
      if (!pageId) throw new McpToolError("page_id is required");
      const ids = db
        .prepare(
          `WITH RECURSIVE descendants(id) AS (
            SELECT id FROM pages WHERE id = ?
            UNION ALL SELECT p.id FROM pages p JOIN descendants d ON p.parent_id = d.id
          ) SELECT id FROM descendants`
        )
        .all(pageId) as unknown as Array<{ id: number }>;
      if (ids.length === 0) throw new McpToolError("Page not found", -32001);
      const removeSearch = db.prepare("DELETE FROM page_search WHERE page_id = ?");
      for (const row of ids) removeSearch.run(row.id);
      db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
      return { ok: true, deleted_ids: ids.map((r) => r.id) };
    },
  },
  {
    name: "create_xinchuan_collection",
    description: "Create a collection.",
    scope: "write:content",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string" },
        icon: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isEditorUser(principal.user)) throw new McpToolError("Editor role required");
      const name = str(args.name).trim();
      if (!name) throw new McpToolError("Name is required");
      const base = slugify(name);
      let slug = base;
      let n = 2;
      while (db.prepare("SELECT id FROM collections WHERE slug = ?").get(slug)) slug = `${base}-${n++}`;
      const info = db
        .prepare("INSERT INTO collections (name, slug, description, icon, position) VALUES (?, ?, ?, ?, ?)")
        .run(name, slug, str(args.description), str(args.icon), 99);
      return db.prepare("SELECT * FROM collections WHERE id = ?").get(Number(info.lastInsertRowid));
    },
  },
  {
    name: "update_xinchuan_collection",
    description: "Rename a collection, change description or icon.",
    scope: "admin:collections",
    inputSchema: {
      type: "object",
      properties: {
        collection_id: { type: "integer", minimum: 1 },
        name: { type: "string" },
        description: { type: "string" },
        icon: { type: "string" },
      },
      required: ["collection_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const collectionId = num(args.collection_id);
      if (!collectionId) throw new McpToolError("collection_id is required");
      const existing = db.prepare("SELECT * FROM collections WHERE id = ?").get(collectionId) as unknown as
        | CollectionRow
        | undefined;
      if (!existing) throw new McpToolError("Collection not found", -32001);
      const name = args.name !== undefined ? str(args.name).trim() : existing.name;
      if (!name) throw new McpToolError("Name is required");
      const description = args.description !== undefined ? str(args.description) : existing.description;
      const icon = args.icon !== undefined ? str(args.icon) : existing.icon;
      let slug = existing.slug;
      if (name !== existing.name) {
        const base = slugify(name);
        slug = base;
        let n = 2;
        while (db.prepare("SELECT id FROM collections WHERE slug = ? AND id != ?").get(slug, collectionId)) {
          slug = `${base}-${n++}`;
        }
      }
      db.prepare("UPDATE collections SET name = ?, slug = ?, description = ?, icon = ? WHERE id = ?").run(
        name,
        slug,
        description,
        icon,
        collectionId
      );
      return db.prepare("SELECT * FROM collections WHERE id = ?").get(collectionId);
    },
  },
  {
    name: "delete_xinchuan_collection",
    description: "Delete a collection and all of its pages.",
    scope: "admin:collections",
    inputSchema: {
      type: "object",
      properties: { collection_id: { type: "integer", minimum: 1 } },
      required: ["collection_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const collectionId = num(args.collection_id);
      if (!collectionId) throw new McpToolError("collection_id is required");
      const existing = db.prepare("SELECT id FROM collections WHERE id = ?").get(collectionId);
      if (!existing) throw new McpToolError("Collection not found", -32001);
      const pageIds = (
        db.prepare("SELECT id FROM pages WHERE collection_id = ?").all(collectionId) as unknown as Array<{ id: number }>
      ).map((r) => r.id);
      if (pageIds.length > 0) {
        const placeholders = pageIds.map(() => "?").join(",");
        db.prepare(`DELETE FROM comments WHERE page_id IN (${placeholders})`).run(...pageIds);
        db.prepare(`DELETE FROM page_search WHERE page_id IN (${placeholders})`).run(...pageIds);
        db.prepare("DELETE FROM pages WHERE collection_id = ?").run(collectionId);
      }
      db.prepare("DELETE FROM collections WHERE id = ?").run(collectionId);
      return { ok: true, deleted_page_ids: pageIds };
    },
  },
  {
    name: "list_xinchuan_comments",
    description: "List comment threads on a page.",
    scope: "read:comments",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "integer", minimum: 1 } },
      required: ["page_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      const pageId = num(args.page_id);
      if (!pageId) throw new McpToolError("page_id is required");
      const page = db.prepare("SELECT status FROM pages WHERE id = ?").get(pageId) as
        | { status: string }
        | undefined;
      if (!page) throw new McpToolError("Page not found", -32001);
      if (page.status !== "published" && !canSeeDrafts(principal)) {
        throw new McpToolError("Draft page requires the read:drafts scope");
      }
      return { comments: getComments(pageId) };
    },
  },
  {
    name: "add_xinchuan_comment",
    description: "Add a comment (or reply) on a page.",
    scope: "write:comments",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "integer", minimum: 1 },
        body: { type: "string", minLength: 1, maxLength: 4000 },
        quote: { type: "string", maxLength: 500 },
        parent_id: { type: "integer", minimum: 1 },
      },
      required: ["page_id", "body"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!canCommentAs(principal.user)) throw new McpToolError("Your role cannot comment");
      const pageId = num(args.page_id);
      const body = str(args.body).trim().slice(0, 4000);
      const quote = str(args.quote).slice(0, 500);
      const parentId = num(args.parent_id);
      if (!pageId) throw new McpToolError("page_id is required");
      if (!body) throw new McpToolError("Comment text is required");
      if (!db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId)) {
        throw new McpToolError("Page not found", -32001);
      }
      const info = db
        .prepare("INSERT INTO comments (page_id, author_id, parent_id, quote, body) VALUES (?, ?, ?, ?, ?)")
        .run(pageId, principal.user.id, parentId, quote, body);
      return getComments(pageId).find((c) => c.id === Number(info.lastInsertRowid));
    },
  },
  {
    name: "delete_xinchuan_comment",
    description: "Soft-delete a comment (own comment, or any if editor).",
    scope: "write:comments",
    inputSchema: {
      type: "object",
      properties: { comment_id: { type: "integer", minimum: 1 } },
      required: ["comment_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      const commentId = num(args.comment_id);
      if (!commentId) throw new McpToolError("comment_id is required");
      const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId) as
        | { id: number; author_id: number; deleted_at: string | null }
        | undefined;
      if (!comment) throw new McpToolError("Comment not found", -32001);
      if (comment.author_id !== principal.user.id && !isEditorUser(principal.user)) {
        throw new McpToolError("Forbidden");
      }
      db.prepare("UPDATE comments SET deleted_at = datetime('now') WHERE id = ?").run(comment.id);
      return { ok: true };
    },
  },
  {
    name: "list_xinchuan_revisions",
    description: "List the latest 50 revisions of a page.",
    scope: "read:revisions",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "integer", minimum: 1 } },
      required: ["page_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isEditorUser(principal.user)) throw new McpToolError("Editor role required");
      const pageId = num(args.page_id);
      if (!pageId) throw new McpToolError("page_id is required");
      if (!db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId)) {
        throw new McpToolError("Page not found", -32001);
      }
      const revisions = db
        .prepare(
          `SELECT r.id, r.page_id, r.title, r.status, r.created_at,
            r.created_by, COALESCE(u.name, 'System') AS editor_name
            FROM page_revisions r LEFT JOIN users u ON u.id = r.created_by
            WHERE r.page_id = ? ORDER BY r.id DESC LIMIT 50`
        )
        .all(pageId);
      return { revisions };
    },
  },
  {
    name: "restore_xinchuan_revision",
    description: "Restore a page to a prior revision (creates a new revision).",
    scope: "read:revisions",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "integer", minimum: 1 },
        revision_id: { type: "integer", minimum: 1 },
      },
      required: ["page_id", "revision_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isEditorUser(principal.user)) throw new McpToolError("Editor role required");
      const pageId = num(args.page_id);
      const revisionId = num(args.revision_id);
      if (!pageId || !revisionId) throw new McpToolError("page_id and revision_id are required");
      const revision = db
        .prepare("SELECT * FROM page_revisions WHERE id = ? AND page_id = ?")
        .get(revisionId, pageId) as unknown as
        | {
            title: string;
            icon: string;
            content_json: string;
            content_html: string;
            status: "draft" | "published";
          }
        | undefined;
      if (!revision) throw new McpToolError("Revision not found", -32001);
      try {
        db.exec("BEGIN IMMEDIATE");
        recordPageRevision(pageId, principal.user.id, true);
        db.prepare(
          `UPDATE pages SET title = ?, icon = ?, content_json = ?, content_html = ?,
            status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
        ).run(
          revision.title,
          revision.icon,
          revision.content_json,
          sanitizeWikiHtml(revision.content_html),
          revision.status,
          principal.user.id,
          pageId
        );
        recordPageRevision(pageId, principal.user.id, true);
        syncPageSearch(pageId);
        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* no transaction */
        }
        throw new McpToolError(error instanceof Error ? error.message : "Restore failed");
      }
      const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow;
      return pagePayload(page, true);
    },
  },
  {
    name: "list_xinchuan_users",
    description: "List users (no password hashes).",
    scope: "admin:users",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (principal) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const users = db.prepare("SELECT * FROM users ORDER BY created_at").all() as unknown as UserRow[];
      return {
        users: users.map(({ password_hash: _ph, ...rest }) => rest),
      };
    },
  },
  {
    name: "create_xinchuan_user",
    description: "Create a user account.",
    scope: "admin:users",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        password: { type: "string", minLength: 6 },
        role: { type: "string", enum: ["superadmin", "admin", "commentator", "guest"] },
      },
      required: ["username", "name", "password"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const username = str(args.username).trim();
      const name = str(args.name).trim();
      const password = str(args.password);
      const role: Role = ROLES.includes(args.role as Role) ? (args.role as Role) : "commentator";
      if (!username || !name || password.length < 6) {
        throw new McpToolError("Name, username and a password of 6+ characters are required");
      }
      if (db.prepare("SELECT id FROM users WHERE lower(username) = ?").get(username.toLowerCase())) {
        throw new McpToolError("A user with this username already exists");
      }
      const info = db
        .prepare("INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)")
        .run(username, name, bcrypt.hashSync(password, 10), role);
      const created = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(info.lastInsertRowid)) as unknown as UserRow;
      const { password_hash: _ph, ...safe } = created;
      return safe;
    },
  },
  {
    name: "update_xinchuan_user",
    description: "Update a user's role, suspension, or password.",
    scope: "admin:users",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "integer", minimum: 1 },
        role: { type: "string", enum: ["superadmin", "admin", "commentator", "guest"] },
        suspended: { type: "integer", enum: [0, 1] },
        password: { type: "string", minLength: 6 },
      },
      required: ["user_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const targetId = num(args.user_id);
      if (!targetId) throw new McpToolError("user_id is required");
      const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as unknown as UserRow | undefined;
      if (!target) throw new McpToolError("User not found", -32001);
      if (ROLES.includes(args.role as Role)) {
        if (target.role === "superadmin" && args.role !== "superadmin") {
          const row = db
            .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND suspended = 0")
            .get() as unknown as { n: number };
          if (row.n <= 1) throw new McpToolError("Cannot demote the last superadmin");
        }
        db.prepare("UPDATE users SET role = ? WHERE id = ?").run(String(args.role), targetId);
      }
      if (args.suspended === 0 || args.suspended === 1) {
        if (target.role === "superadmin" && args.suspended === 1) {
          const row = db
            .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND suspended = 0")
            .get() as unknown as { n: number };
          if (row.n <= 1) throw new McpToolError("Cannot suspend the last active superadmin");
        }
        db.prepare("UPDATE users SET suspended = ? WHERE id = ?").run(args.suspended, targetId);
      }
      if (typeof args.password === "string" && args.password.length >= 6) {
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
          bcrypt.hashSync(args.password, 10),
          targetId
        );
      }
      const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as unknown as UserRow;
      const { password_hash: _ph, ...safe } = updated;
      return safe;
    },
  },
  {
    name: "delete_xinchuan_user",
    description: "Delete a user account.",
    scope: "admin:users",
    inputSchema: {
      type: "object",
      properties: { user_id: { type: "integer", minimum: 1 } },
      required: ["user_id"],
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const targetId = num(args.user_id);
      if (!targetId) throw new McpToolError("user_id is required");
      if (targetId === principal.user.id) throw new McpToolError("You cannot delete your own account");
      const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as unknown as UserRow | undefined;
      if (!target) throw new McpToolError("User not found", -32001);
      if (target.role === "superadmin") {
        const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get() as unknown as {
          n: number;
        };
        if (row.n <= 1) throw new McpToolError("Cannot delete the last superadmin");
      }
      try {
        db.exec("BEGIN");
        db.prepare("DELETE FROM comments WHERE author_id = ?").run(targetId);
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
        db.prepare("DELETE FROM access_tokens WHERE user_id = ?").run(targetId);
        db.prepare("UPDATE pages SET updated_by = NULL WHERE updated_by = ?").run(targetId);
        db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
        db.exec("COMMIT");
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw new McpToolError(err instanceof Error ? err.message : "Delete failed");
      }
      return { ok: true };
    },
  },
  {
    name: "get_xinchuan_settings",
    description: "Read site settings.",
    scope: "admin:settings",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (principal) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      return {
        site_name: getSetting("site_name", "Xinchuan Knowledge Center"),
        open_registration: getSetting("open_registration", "0"),
        comment_approval: getSetting("comment_approval", "0"),
      };
    },
  },
  {
    name: "update_xinchuan_settings",
    description: "Update site settings.",
    scope: "admin:settings",
    inputSchema: {
      type: "object",
      properties: {
        site_name: { type: "string" },
        open_registration: { type: "string", enum: ["0", "1"] },
        comment_approval: { type: "string", enum: ["0", "1"] },
      },
      additionalProperties: false,
    },
    handler: (principal, args) => {
      if (!isSuperadmin(principal.user)) throw new McpToolError("Superadmin role required");
      const keys: Array<"site_name" | "open_registration" | "comment_approval"> = [
        "site_name",
        "open_registration",
        "comment_approval",
      ];
      for (const key of keys) {
        if (typeof args[key] === "string") setSetting(key, String(args[key]));
      }
      return {
        site_name: getSetting("site_name", "Xinchuan Knowledge Center"),
        open_registration: getSetting("open_registration", "0"),
        comment_approval: getSetting("comment_approval", "0"),
      };
    },
  },
];

export function listToolDefinitions(principal: TokenPrincipal) {
  return tools
    .filter((tool) => hasScope(principal, tool.scope))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: !/create_|update_|delete_|restore_|add_/.test(tool.name),
      },
    }));
}

export async function callTool(
  principal: TokenPrincipal,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new McpToolError(`Unknown tool: ${name}`, -32601);
  requireScope(principal, tool.scope);
  return tool.handler(principal, args || {});
}

export function jsonRpcResult(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

export function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  });
}
