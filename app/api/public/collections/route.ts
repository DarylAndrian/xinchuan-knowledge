import { NextResponse } from "next/server";
import { db, getSetting } from "@/lib/db";

export async function GET() {
  if (getSetting("public_viewing", "1") !== "1") {
    return NextResponse.json({ error: "Public viewing is disabled." }, { status: 403 });
  }
  const collections = db.prepare(`SELECT c.id, c.name, c.slug, c.description, c.icon,
    COUNT(p.id) AS page_count
    FROM collections c
    LEFT JOIN pages p ON p.collection_id = c.id AND p.status = 'published'
    GROUP BY c.id
    ORDER BY c.position, c.name`).all();
  return NextResponse.json({ collections });
}
