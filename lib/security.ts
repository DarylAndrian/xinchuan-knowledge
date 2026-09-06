import { NextRequest, NextResponse } from "next/server";

/** Reject browser cross-site mutations. Server-to-server requests without Origin remain supported. */
export function enforceSameOrigin(req: NextRequest): NextResponse | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }

  const origin = req.headers.get("origin");
  if (!origin) return null;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(req.url).origin;
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 400 });
  }

  if (origin !== requestOrigin) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  return null;
}

type LoginAttempt = { failures: number; resetAt: number };
const globalRateLimit = globalThis as unknown as { xkLoginAttempts?: Map<string, LoginAttempt> };
const loginAttempts = globalRateLimit.xkLoginAttempts ?? new Map<string, LoginAttempt>();
globalRateLimit.xkLoginAttempts = loginAttempts;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

export function loginRateLimitKey(req: NextRequest, username: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  return `${ip}:${username.toLowerCase()}`;
}

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.delete(key);
    return { allowed: true, retryAfter: 0 };
  }
  if (attempt.failures < MAX_LOGIN_FAILURES) return { allowed: true, retryAfter: 0 };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)) };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    current.failures += 1;
  }

  // Keep the process-local limiter bounded even if usernames are sprayed.
  if (loginAttempts.size > 5000) {
    for (const [entryKey, attempt] of loginAttempts) {
      if (attempt.resetAt <= now) loginAttempts.delete(entryKey);
    }
    while (loginAttempts.size > 5000) {
      const oldestKey = loginAttempts.keys().next().value as string | undefined;
      if (!oldestKey) break;
      loginAttempts.delete(oldestKey);
    }
  }
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}
