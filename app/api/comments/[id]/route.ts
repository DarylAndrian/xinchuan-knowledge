import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";

async function load(id: number) {
  return db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as
    | { id: number; author_id: number; page_id: number; deleted_at: string | null }
    | undefined;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const comment = await load(Number(id));
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.author_id !== user.id && !isEditor(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body.body === "string") {
    db.prepare("UPDATE comments SET body = ? WHERE id = ?").run(body.body.slice(0, 4000), comment.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const comment = await load(Number(id));
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.author_id !== user.id && !isEditor(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  db.prepare("UPDATE comments SET deleted_at = datetime('now') WHERE id = ?").run(comment.id);
  return NextResponse.json({ ok: true });
}
