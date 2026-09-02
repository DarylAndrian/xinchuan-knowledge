import { NextRequest, NextResponse } from "next/server";
import { db, slugify, CollectionRow, ensureSeeded } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";

export async function GET() {
  ensureSeeded();
  const rows = db.prepare("SELECT * FROM collections ORDER BY position, name").all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT id FROM collections WHERE slug = ?").get(slug)) slug = `${base}-${n++}`;

  const info = db
    .prepare("INSERT INTO collections (name, slug, description, icon, position) VALUES (?, ?, ?, ?, ?)")
    .run(name, slug, String(body.description || ""), String(body.icon || ""), 99);

  const collection = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as unknown as CollectionRow;
  return NextResponse.json(collection, { status: 201 });
}
