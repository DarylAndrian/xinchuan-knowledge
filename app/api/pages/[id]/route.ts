import { NextRequest, NextResponse } from "next/server";
import { db, slugify, PageRow, recordPageRevision, syncPageSearch } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";
import { sanitizeWikiHtml } from "@/lib/content";
import { enforceSameOrigin } from "@/lib/security";

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
  for (const key of ["icon", "content_json"] as const) {
    if (typeof body[key] === "string") {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (typeof body.content_html === "string") {
    sets.push("content_html = ?");
    values.push(sanitizeWikiHtml(body.content_html));
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
  values.push(user!.id, pageId);
  db.prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const forceRevision = body.status && body.status !== existing.status;
  recordPageRevision(pageId, user!.id, Boolean(forceRevision));
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
  const removeSearch = db.prepare("DELETE FROM page_search WHERE page_id = ?");
  for (const row of ids) removeSearch.run(row.id);
  db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
  return NextResponse.json({ ok: true });
}
