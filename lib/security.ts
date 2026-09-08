import { NextRequest, NextResponse } from "next/server";

function crossSiteRejected(): NextResponse {
  return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
}

function headerValues(req: NextRequest, name: string): string[] {
  const raw = req.headers.get(name);
  if (!raw) return [];
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

/** Hosts the reverse proxy / browser presented for this request (public host first). */
function requestHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  for (const value of [
    ...headerValues(req, "x-forwarded-host"),
    ...headerValues(req, "host"),
  ]) {
    hosts.add(value.toLowerCase());
  }
  try {
    hosts.add(new URL(req.url).host.toLowerCase());
  } catch {
    // ignore malformed request URLs; host headers still apply
  }
  return hosts;
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

function configuredOrigins(): string[] {
  return [process.env.APP_ORIGIN, process.env.APP_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));
}

/**
 * Reject browser cross-site mutations. Server-to-server requests without Origin remain supported.
 *
 * Do not compare Origin to `new URL(req.url).origin`: behind Cloudflare / a reverse proxy
 * that value is often `http://localhost:…` while the browser sends `https://public-host`.
 */
export function enforceSameOrigin(req: NextRequest): NextResponse | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return crossSiteRejected();
  // Modern browsers mark first-party fetch/XHR as same-origin / same-site / none.
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return null;
  }

  const origin = req.headers.get("origin");
  if (!origin) return null;

  if (configuredOrigins().includes(origin)) return null;

  const host = originHost(origin);
  if (!host) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 400 });
  }
  if (!requestHosts(req).has(host)) return crossSiteRejected();
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
