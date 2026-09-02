import { NextRequest, NextResponse } from "next/server";
import { db, slugify, PageRow } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";

export async function GET() {
  const pages = db
    .prepare("SELECT * FROM pages ORDER BY collection_id, position, title")
    .all() as unknown as PageRow[];
  return NextResponse.json(pages);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const collectionId = Number(body.collection_id);
  const title = String(body.title || "Untitled").trim() || "Untitled";
  const parentId = body.parent_id ? Number(body.parent_id) : null;

  if (!db.prepare("SELECT id FROM collections WHERE id = ?").get(collectionId)) {
    return NextResponse.json({ error: "Collection not found." }, { status: 400 });
  }

  // unique slug within (collection, parent)
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (
    db
      .prepare(
        "SELECT id FROM pages WHERE collection_id = ? AND COALESCE(parent_id,0) = COALESCE(?,0) AND slug = ?"
      )
      .get(collectionId, parentId, slug)
  ) {
    slug = `${base}-${n++}`;
  }

  const pos = (
    db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM pages WHERE collection_id = ? AND COALESCE(parent_id,0) = COALESCE(?,0)")
      .get(collectionId, parentId) as { p: number }
  ).p;

  const info = db
    .prepare(
      "INSERT INTO pages (collection_id, parent_id, title, slug, position, updated_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(collectionId, parentId, title, slug, pos, user!.id);

  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(Number(info.lastInsertRowid));
  return NextResponse.json(page, { status: 201 });
}
