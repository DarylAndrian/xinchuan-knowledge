import { NextRequest, NextResponse } from "next/server";
import { db, PageRevisionRow, recordPageRevision, syncPageSearch, STALE_PAGE_MESSAGE } from "@/lib/db";
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
  const body = await req.json().catch(() => ({}));
  const expectedUpdatedAt =
    typeof body.expected_updated_at === "string" && body.expected_updated_at ? body.expected_updated_at : null;
  const existing = db.prepare("SELECT updated_at FROM pages WHERE id = ?").get(pageId) as
    | { updated_at: string }
    | undefined;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (expectedUpdatedAt && expectedUpdatedAt !== existing.updated_at) {
    return NextResponse.json(
      { error: STALE_PAGE_MESSAGE, code: "stale_page", updated_at: existing.updated_at },
      { status: 409 },
    );
  }

  try {
    db.exec("BEGIN IMMEDIATE");
    recordPageRevision(pageId, user!.id, true, "editor");
    const updated = db.prepare(`UPDATE pages SET title = ?, icon = ?, content_json = ?, content_html = ?,
      status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?${expectedUpdatedAt ? " AND updated_at = ?" : ""}`)
      .run(
        revision.title,
        revision.icon,
        revision.content_json,
        sanitizeWikiHtml(revision.content_html),
        revision.status,
        user!.id,
        pageId,
        ...(expectedUpdatedAt ? [expectedUpdatedAt] : []),
      );
    if (Number(updated.changes) === 0) {
      const latest = db.prepare("SELECT updated_at FROM pages WHERE id = ?").get(pageId) as
        | { updated_at: string }
        | undefined;
      if (!latest || (expectedUpdatedAt && latest.updated_at !== expectedUpdatedAt)) {
        db.exec("ROLLBACK");
        return NextResponse.json(
          { error: STALE_PAGE_MESSAGE, code: "stale_page", updated_at: latest?.updated_at ?? null },
          { status: 409 },
        );
      }
    }
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
