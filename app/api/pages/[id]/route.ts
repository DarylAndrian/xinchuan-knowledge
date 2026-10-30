import { NextRequest, NextResponse } from "next/server";
import {
  db, slugify, PageRow, recordPageRevision, syncPageSearch, removePageSearch, commitPageUpdate, STALE_PAGE_MESSAGE, RevisionSource,
} from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";
import { sanitizeWikiHtml } from "@/lib/content";
import { contentJsonFromHtml, providedContentJson } from "@/lib/doc-json";
import { enforceSameOrigin } from "@/lib/security";

function stale(updatedAt: string | null) {
  return NextResponse.json(
    { error: STALE_PAGE_MESSAGE, code: "stale_page", updated_at: updatedAt },
    { status: 409 },
  );
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(Number(id));
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(page);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const pageId = Number(id);
  const existing = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow | undefined;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const expectedUpdatedAt =
    typeof body.expected_updated_at === "string" && body.expected_updated_at ? body.expected_updated_at : null;
  if (expectedUpdatedAt && expectedUpdatedAt !== existing.updated_at) {
    return stale(existing.updated_at);
  }

  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  const targetCollectionId = typeof body.collection_id === "number"
    ? body.collection_id
    : existing.collection_id;
  const targetParentId = "parent_id" in body
    ? (body.parent_id ? Number(body.parent_id) : null)
    : existing.parent_id;

  if (!db.prepare("SELECT id FROM collections WHERE id = ?").get(targetCollectionId)) {
    return NextResponse.json({ error: "Collection not found." }, { status: 400 });
  }
  if (targetParentId === pageId) {
    return NextResponse.json({ error: "A page cannot be its own parent." }, { status: 400 });
  }
  if (targetParentId) {
    const parent = db.prepare("SELECT collection_id FROM pages WHERE id = ?").get(targetParentId) as
      | { collection_id: number }
      | undefined;
    if (!parent || parent.collection_id !== targetCollectionId) {
      return NextResponse.json({ error: "Parent page must belong to the selected collection." }, { status: 400 });
    }
    const cycle = db.prepare(`WITH RECURSIVE descendants(id) AS (
      SELECT id FROM pages WHERE parent_id = ?
      UNION ALL SELECT p.id FROM pages p JOIN descendants d ON p.parent_id = d.id
    ) SELECT id FROM descendants WHERE id = ? LIMIT 1`).get(pageId, targetParentId);
    if (cycle) return NextResponse.json({ error: "That move would create a page cycle." }, { status: 400 });
  }

  const slugTaken = (slug: string) =>
    db
      .prepare(
        "SELECT id FROM pages WHERE collection_id = ? AND COALESCE(parent_id,0) = COALESCE(?,0) AND slug = ? AND id != ?"
      )
      .get(targetCollectionId, targetParentId, slug);

  // Explicit slug edit: normalize, reject empties and collisions.
  const slugProvided = typeof body.slug === "string";
  if (slugProvided) {
    const slug = slugify(body.slug.trim());
    if (!slug) return NextResponse.json({ error: "Slug can't be empty." }, { status: 400 });
    if (slugTaken(slug))
      return NextResponse.json(
        { error: "That slug is already used by another page here." },
        { status: 409 }
      );
    sets.push("slug = ?");
    values.push(slug);
  }

  if (typeof body.title === "string") {
    const title = body.title.trim() || "Untitled";
    sets.push("title = ?");
    values.push(title);
    // Regenerate the slug from the title only when no explicit slug was sent
    // and the current slug still looks auto-generated (so typing never clobbers
    // a slug the user customized, and never produces duplicates).
    if (!slugProvided && title !== existing.title && existing.slug === slugify(existing.title)) {
      const base = slugify(title);
      let slug = base;
      let n = 2;
      while (slugTaken(slug)) slug = `${base}-${n++}`;
      sets.push("slug = ?");
      values.push(slug);
    }
  }
  if (typeof body.icon === "string") {
    sets.push("icon = ?");
    values.push(body.icon);
  }
  const html = typeof body.content_html === "string" ? sanitizeWikiHtml(body.content_html) : undefined;
  const explicitJson = providedContentJson(body.content_json);
  if (html !== undefined) {
    sets.push("content_html = ?");
    values.push(html);
  }
  if (explicitJson) {
    sets.push("content_json = ?");
    values.push(explicitJson);
  } else if (html !== undefined) {
    sets.push("content_json = ?");
    values.push(contentJsonFromHtml(html));
  } else if (typeof body.content_json === "string") {
    sets.push("content_json = ?");
    values.push(body.content_json);
  }
  if (body.status === "draft" || body.status === "published") {
    sets.push("status = ?");
    values.push(body.status);
  }
  if ("parent_id" in body) {
    sets.push("parent_id = ?");
    values.push(body.parent_id ? Number(body.parent_id) : null);
  }
  if (typeof body.collection_id === "number") {
    sets.push("collection_id = ?");
    values.push(body.collection_id);
  }
  if (sets.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  sets.push("updated_at = datetime('now')", "updated_by = ?");
  values.push(user!.id);
  const written = commitPageUpdate(pageId, sets, values, expectedUpdatedAt);
  if (written.status === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (written.status === "stale") return stale(written.updated_at);

  const forceRevision = body.status && body.status !== existing.status;
  const source: RevisionSource = body.source === "editor" ? "editor" : "api";
  recordPageRevision(pageId, user!.id, Boolean(forceRevision), source);
  syncPageSearch(pageId);
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  return NextResponse.json(page);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const pageId = Number(id);
  const ids = db.prepare(`WITH RECURSIVE descendants(id) AS (
    SELECT id FROM pages WHERE id = ?
    UNION ALL SELECT p.id FROM pages p JOIN descendants d ON p.parent_id = d.id
  ) SELECT id FROM descendants`).all(pageId) as unknown as Array<{ id: number }>;
  for (const row of ids) removePageSearch(row.id);
  db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
  return NextResponse.json({ ok: true });
}
