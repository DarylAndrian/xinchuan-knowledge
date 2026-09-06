import { NextRequest, NextResponse } from "next/server";
import { db, PageRevisionRow, recordPageRevision, syncPageSearch } from "@/lib/db";
import { getSessionUser, isEditor } from "@/lib/auth";
import { sanitizeWikiHtml } from "@/lib/content";
import { enforceSameOrigin } from "@/lib/security";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!isEditor(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, revisionId } = await params;
  const pageId = Number(id);
  const revision = db.prepare("SELECT * FROM page_revisions WHERE id = ? AND page_id = ?")
    .get(Number(revisionId), pageId) as unknown as PageRevisionRow | undefined;
  if (!revision) return NextResponse.json({ error: "Revision not found." }, { status: 404 });

  try {
    db.exec("BEGIN IMMEDIATE");
    recordPageRevision(pageId, user!.id, true);
    db.prepare(`UPDATE pages SET title = ?, icon = ?, content_json = ?, content_html = ?,
      status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`)
      .run(
        revision.title,
        revision.icon,
        revision.content_json,
        sanitizeWikiHtml(revision.content_html),
        revision.status,
        user!.id,
        pageId
      );
    recordPageRevision(pageId, user!.id, true);
    syncPageSearch(pageId);
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* no active transaction */ }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed." },
      { status: 500 }
    );
  }
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  return NextResponse.json({ page });
}
