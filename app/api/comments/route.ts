import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getComments } from "@/lib/comments";

export async function GET(req: NextRequest) {
  const pageId = Number(req.nextUrl.searchParams.get("page_id"));
  if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 });
  return NextResponse.json(getComments(pageId));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pageId = Number(body.page_id);
  const quote = String(body.quote || "").slice(0, 500);
  const commentBody = String(body.body || "").slice(0, 4000);
  const parentId = body.parent_id ? Number(body.parent_id) : null;

  if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 });
  if (!quote && !commentBody.trim()) {
    return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
  }
  if (!db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId)) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }

  const info = db
    .prepare(
      "INSERT INTO comments (page_id, author_id, parent_id, quote, body) VALUES (?, ?, ?, ?, ?)"
    )
    .run(pageId, user.id, parentId, quote, commentBody.trim());

  const comment = getComments(pageId).find((c) => c.id === Number(info.lastInsertRowid));
  return NextResponse.json(comment, { status: 201 });
}
