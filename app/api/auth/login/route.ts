import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE, getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const user = db
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .get(String(email).trim()) as
    | { id: number; password_hash: string; suspended: number }
    | undefined;
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
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
