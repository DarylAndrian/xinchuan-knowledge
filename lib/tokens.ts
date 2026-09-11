import crypto from "crypto";
import { db, ensureSeeded, Role } from "./db";

export const TOKEN_PREFIX = "xk_pat_";

export const ALL_SCOPES = [
  "read:content",
  "write:content",
  "read:comments",
  "write:comments",
  "read:revisions",
  "read:drafts",
  "admin:collections",
  "admin:users",
  "admin:settings",
] as const;

export type Scope = (typeof ALL_SCOPES)[number];

export interface AccessTokenRow {
  id: number;
  user_id: number;
  name: string;
  token_hash: string;
  token_prefix: string;
  scopes: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: number | null;
}

export interface AccessTokenPublic {
  id: number;
  name: string;
  token_prefix: string;
  scopes: Scope[];
  last_used_at: string | null;
  created_at: string;
  expires_at: number | null;
}

export interface TokenPrincipal {
  user: {
    id: number;
    username: string;
    name: string;
    role: Role;
  };
  tokenId: number;
  scopes: Set<Scope>;
}

const ROLE_CAPS: Record<Role, Scope[]> = {
  guest: ["read:content"],
  commentator: ["read:content", "read:comments", "write:comments"],
  admin: [
    "read:content",
    "write:content",
    "read:comments",
    "write:comments",
    "read:revisions",
    "read:drafts",
  ],
  superadmin: [...ALL_SCOPES],
};

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && (ALL_SCOPES as readonly string[]).includes(value);
}

export function scopesForRole(role: Role): Scope[] {
  return [...ROLE_CAPS[role]];
}

export function intersectScopes(requested: Scope[], role: Role): Scope[] {
  const cap = new Set(ROLE_CAPS[role]);
  return requested.filter((scope) => cap.has(scope));
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parseScopes(raw: string): Scope[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScope);
  } catch {
    return [];
  }
}

export function toPublicToken(row: AccessTokenRow): AccessTokenPublic {
  return {
    id: row.id,
    name: row.name,
    token_prefix: row.token_prefix,
    scopes: parseScopes(row.scopes),
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export function createAccessToken(input: {
  userId: number;
  name: string;
  scopes: Scope[];
  ownerRole: Role;
  expiresAt?: number | null;
}): { token: string; row: AccessTokenPublic } {
  ensureSeeded();
  const name = input.name.trim().slice(0, 80) || "Access token";
  const unique = [...new Set(intersectScopes(input.scopes, input.ownerRole))] as Scope[];
  if (unique.length === 0) {
    throw new Error("No valid scopes for this role.");
  }
  const token = `${TOKEN_PREFIX}${crypto.randomBytes(20).toString("hex")}`;
  const hash = hashToken(token);
  const prefix = token.slice(0, 12);
  const info = db
    .prepare(
      `INSERT INTO access_tokens (user_id, name, token_hash, token_prefix, scopes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(input.userId, name, hash, prefix, JSON.stringify(unique), input.expiresAt ?? null);
  const row = db
    .prepare("SELECT * FROM access_tokens WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as unknown as AccessTokenRow;
  return { token, row: toPublicToken(row) };
}

export function listAccessTokens(userId: number): AccessTokenPublic[] {
  ensureSeeded();
  const rows = db
    .prepare("SELECT * FROM access_tokens WHERE user_id = ? ORDER BY created_at DESC, id DESC")
    .all(userId) as unknown as AccessTokenRow[];
  return rows.map(toPublicToken);
}

export function revokeAccessToken(userId: number, tokenId: number): boolean {
  const info = db.prepare("DELETE FROM access_tokens WHERE id = ? AND user_id = ?").run(tokenId, userId);
  return Number(info.changes) > 0;
}

export function touchAccessToken(tokenId: number): void {
  db.prepare("UPDATE access_tokens SET last_used_at = datetime('now') WHERE id = ?").run(tokenId);
}

/** Authenticate a bearer PAT. Returns null when missing, expired, revoked, or suspended. */
export function authenticateAccessToken(token: string | null | undefined): TokenPrincipal | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  ensureSeeded();
  const hash = hashToken(token);
  const row = db
    .prepare(
      `SELECT t.id AS token_id, t.scopes, t.expires_at, t.user_id,
              u.username, u.name, u.role, u.suspended
       FROM access_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`
    )
    .get(hash) as unknown as
    | {
        token_id: number;
        scopes: string;
        expires_at: number | null;
        user_id: number;
        username: string;
        name: string;
        role: Role;
        suspended: number;
      }
    | undefined;
  if (!row) return null;
  if (row.suspended) return null;
  if (row.expires_at && row.expires_at < Date.now()) return null;

  const stored = parseScopes(row.scopes);
  const effective = intersectScopes(stored, row.role);
  if (effective.length === 0) return null;

  touchAccessToken(row.token_id);
  return {
    user: {
      id: row.user_id,
      username: row.username,
      name: row.name,
      role: row.role,
    },
    tokenId: row.token_id,
    scopes: new Set(effective),
  };
}

export function hasScope(principal: TokenPrincipal, scope: Scope): boolean {
  return principal.scopes.has(scope);
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
