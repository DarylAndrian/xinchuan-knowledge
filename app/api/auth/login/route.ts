import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE, getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Accept `username` (new) and `email` (legacy clients) as the login field.
  const username = String(body.username ?? body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }
  const user = db
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?)")
    .get(username) as
    | { id: number; password_hash: string; suspended: number }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  if (user.suspended) {
    return NextResponse.json({ error: "This account is suspended." }, { status: 403 });
  }
  const { token, maxAge } = createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}
