import { NextRequest, NextResponse } from "next/server";
import { getCollectionPages, hrefForPage, searchPages } from "@/lib/pages";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
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
