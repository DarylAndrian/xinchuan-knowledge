import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { getCollectionPages, getRecentPages, hrefForPage } from "@/lib/pages";

export async function GET(req: NextRequest) {
  if (getSetting("public_viewing", "1") !== "1") {
    return NextResponse.json({ error: "Public viewing is disabled." }, { status: 403 });
  }
  const requested = Number(req.nextUrl.searchParams.get("limit") || 10);
  const limit = Number.isFinite(requested) ? Math.min(20, Math.max(1, Math.floor(requested))) : 10;
  const pages = getRecentPages(limit).map((page) => ({
    id: page.id,
    title: page.title,
    collection: page.collection_name,
    href: hrefForPage(page.collection_slug, getCollectionPages(page.collection_id), page.id),
    updated_at: page.updated_at,
  }));
  return NextResponse.json({ pages });
}
