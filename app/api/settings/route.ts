import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, ensureSeeded } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const KEYS = ["site_name", "public_viewing", "open_registration", "comment_approval"];

export async function GET() {
  ensureSeeded();
  const out: Record<string, string> = {};
  for (const k of KEYS) out[k] = getSetting(k, k === "site_name" ? "Xinchuan Knowledge Center" : k === "public_viewing" ? "1" : "0");
  return NextResponse.json(out);
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  for (const k of KEYS) {
    if (typeof body[k] === "string" || typeof body[k] === "number") {
      setSetting(k, String(body[k]));
    }
  }
  return NextResponse.json({ ok: true });
}
