import { NextRequest, NextResponse } from "next/server";
import { db, slugify, CollectionRow } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/security";

function requireSuperadmin(user: Awaited<ReturnType<typeof getSessionUser>>) {
  return !!user && user.role === "superadmin";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!requireSuperadmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const collectionId = Number(id);
  if (!Number.isFinite(collectionId)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const existing = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(collectionId) as unknown as CollectionRow | undefined;
  if (!existing) return NextResponse.json({ error: "Collection not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const description = body.description !== undefined ? String(body.description) : existing.description;
  const icon = body.icon !== undefined ? String(body.icon) : existing.icon;

  // Regenerate slug when the name changed; keep uniqueness.
  let slug = existing.slug;
  if (name !== existing.name) {
    const base = slugify(name);
    slug = base;
    let n = 2;
    while (
      db.prepare("SELECT id FROM collections WHERE slug = ? AND id != ?").get(slug, collectionId)
    ) {
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

  const updated = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(collectionId) as unknown as CollectionRow;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!requireSuperadmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const collectionId = Number(id);
  if (!Number.isFinite(collectionId)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const existing = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(collectionId) as unknown as CollectionRow | undefined;
  if (!existing) return NextResponse.json({ error: "Collection not found." }, { status: 404 });

  // Pages cascade via FK; delete explicitly first for clarity + comment cleanup.
  const pageIds = (
    db.prepare("SELECT id FROM pages WHERE collection_id = ?").all(collectionId) as unknown as Array<{
      id: number;
    }>
  ).map((r) => r.id);
  if (pageIds.length > 0) {
    const placeholders = pageIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM comments WHERE page_id IN (${placeholders})`).run(...pageIds);
    db.prepare(`DELETE FROM page_search WHERE page_id IN (${placeholders})`).run(...pageIds);
    db.prepare("DELETE FROM pages WHERE collection_id = ?").run(collectionId);
  }
  db.prepare("DELETE FROM collections WHERE id = ?").run(collectionId);

  return NextResponse.json({ ok: true });
}
