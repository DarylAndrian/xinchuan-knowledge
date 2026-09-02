import { NextRequest, NextResponse } from "next/server";
import { db, slugify } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const pageId = Number(id);
  const existing = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as
    | { id: number; title: string; slug: string }
    | undefined;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (typeof body.title === "string") {
    const title = body.title.trim() || "Untitled";
    sets.push("title = ?");
    values.push(title);
    if (title !== existing.title) {
      sets.push("slug = ?");
      values.push(slugify(title));
    }
  }
  for (const key of ["icon", "content_json", "content_html"] as const) {
    if (typeof body[key] === "string") {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
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

  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  return NextResponse.json(page);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  db.prepare("DELETE FROM pages WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
