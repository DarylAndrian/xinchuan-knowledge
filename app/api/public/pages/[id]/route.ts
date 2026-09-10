import { NextResponse } from "next/server";
import { db, PageRow } from "@/lib/db";
import { htmlToText } from "@/lib/content";
import { getCollectionPages, hrefForPage } from "@/lib/pages";
import { getSessionUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const page = db.prepare(`SELECT p.*, c.name AS collection_name, c.slug AS collection_slug
    FROM pages p JOIN collections c ON c.id = p.collection_id
    WHERE p.id = ? AND p.status = 'published'`).get(Number(id)) as unknown as
      | (PageRow & { collection_name: string; collection_slug: string })
      | undefined;
  if (!page) return NextResponse.json({ error: "Published page not found." }, { status: 404 });
  return NextResponse.json({
    id: page.id,
    title: page.title,
    collection: page.collection_name,
    href: hrefForPage(page.collection_slug, getCollectionPages(page.collection_id), page.id),
    content: htmlToText(page.content_html),
    updated_at: page.updated_at,
  });
}
