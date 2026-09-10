import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const collections = db.prepare(`SELECT c.id, c.name, c.slug, c.description, c.icon,
    COUNT(p.id) AS page_count
    FROM collections c
    LEFT JOIN pages p ON p.collection_id = c.id AND p.status = 'published'
    GROUP BY c.id
    ORDER BY c.position, c.name`).all();
  return NextResponse.json({ collections });
}
