import { NextRequest, NextResponse } from "next/server";
import { searchPages, toPublicSearchHit } from "@/lib/pages";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const query = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);
  if (!query) return NextResponse.json({ query, results: [] });
  const collection = (req.nextUrl.searchParams.get("collection") || "").trim();
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam == null || limitParam.trim() === "" ? undefined : Number(limitParam);
  const results = searchPages(query, {
    collection: collection || undefined,
    limit,
  }).map(toPublicSearchHit);
  return NextResponse.json({ query, results });
}
