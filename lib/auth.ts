import { cookies } from "next/headers";
import crypto from "crypto";
import { db, UserRow, ensureSeeded } from "./db";

export const SESSION_COOKIE = "xk_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: UserRow["role"];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  ensureSeeded();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.suspended, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as unknown as
    | (SessionUser & { suspended: number; expires_at: number })
    | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  if (row.suspended) return null;
  return { id: row.id, username: row.username, name: row.name, role: row.role };
}

export function createSession(userId: number): { token: string; maxAge: number } {
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    Date.now() + maxAge * 1000
  );
  return { token, maxAge };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function isEditor(user: SessionUser | null): boolean {
  return !!user && (user.role === "admin" || user.role === "superadmin");
}
