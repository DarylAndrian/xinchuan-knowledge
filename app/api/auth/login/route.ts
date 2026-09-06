import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  enforceSameOrigin,
  loginRateLimitKey,
  recordLoginFailure,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const body = await req.json().catch(() => ({}));
  // Accept `username` (new) and `email` (legacy clients) as the login field.
  const username = String(body.username ?? body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }
  const rateLimitKey = loginRateLimitKey(req, username);
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }
  const user = db
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?)")
    .get(username) as
    | { id: number; password_hash: string; suspended: number }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginFailure(rateLimitKey);
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  if (user.suspended) {
    recordLoginFailure(rateLimitKey);
    return NextResponse.json({ error: "This account is suspended." }, { status: 403 });
  }
  const { token, maxAge } = createSession(user.id);
  clearLoginFailures(rateLimitKey);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}
