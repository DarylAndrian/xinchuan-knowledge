import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { getCollectionPages, hrefForPage, searchPages } from "@/lib/pages";

export async function GET(req: NextRequest) {
  if (getSetting("public_viewing", "1") !== "1") {
    return NextResponse.json({ error: "Public viewing is disabled." }, { status: 403 });
  }
  const query = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);
  if (!query) return NextResponse.json({ query, results: [] });
  const results = searchPages(query).map((page) => ({
    id: page.id,
    title: page.title,
    collection: page.collection_name,
    href: hrefForPage(page.collection_slug, getCollectionPages(page.collection_id), page.id),
    snippet: page.search_snippet || "",
    updated_at: page.updated_at,
  }));
  return NextResponse.json({ query, results });
}
