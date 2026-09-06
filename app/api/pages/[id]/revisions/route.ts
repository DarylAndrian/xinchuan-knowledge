import { NextResponse } from "next/server";
import { db, PageRevisionRow } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const pageId = Number(id);
  if (!db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId)) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }
  const revisions = db.prepare(`SELECT r.id, r.page_id, r.title, r.status, r.created_at,
    r.created_by, COALESCE(u.name, 'System') AS editor_name
    FROM page_revisions r LEFT JOIN users u ON u.id = r.created_by
    WHERE r.page_id = ? ORDER BY r.id DESC LIMIT 50`).all(pageId) as unknown as PageRevisionRow[];
  return NextResponse.json({ revisions });
}
