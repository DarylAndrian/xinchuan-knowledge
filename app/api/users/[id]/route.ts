import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, UserRow, Role } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/security";

const ROLES: Role[] = ["superadmin", "admin", "commentator"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const me = await getSessionUser();
  if (!me || me.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const targetId = Number(id);
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as unknown as
    | UserRow
    | undefined;
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (ROLES.includes(body.role)) {
    // never demote the last superadmin
    if (target.role === "superadmin" && body.role !== "superadmin") {
      const row = db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND suspended = 0")
        .get() as unknown as { n: number };
      if (row.n <= 1) {
        return NextResponse.json({ error: "Cannot demote the last superadmin." }, { status: 400 });
      }
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role, targetId);
  }
  if (typeof body.suspended === "number") {
    if (target.role === "superadmin" && body.suspended === 1) {
      const row = db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND suspended = 0")
        .get() as unknown as { n: number };
      if (row.n <= 1) {
        return NextResponse.json({ error: "Cannot suspend the last active superadmin." }, { status: 400 });
      }
    }
    db.prepare("UPDATE users SET suspended = ? WHERE id = ?").run(body.suspended, targetId);
  }
  if (typeof body.password === "string" && body.password.length >= 6) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      bcrypt.hashSync(body.password, 10),
      targetId
    );
  }

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as unknown as UserRow;
  const { password_hash, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const me = await getSessionUser();
  if (!me || me.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const targetId = Number(id);
  if (targetId === me.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as unknown as
    | UserRow
    | undefined;
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "superadmin") {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'")
      .get() as unknown as { n: number };
    if (row.n <= 1) {
      return NextResponse.json({ error: "Cannot delete the last superadmin." }, { status: 400 });
    }
  }

  try {
    db.exec("BEGIN");
    db.prepare("DELETE FROM comments WHERE author_id = ?").run(targetId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
    // pages.updated_by references users(id) WITHOUT ON DELETE, so an FK
    // violation ("FOREIGN KEY constraint failed" -> unhandled throw -> 500)
    // happened when deleting a user who had ever edited a page. Clear the
    // attribution instead of cascading: the page stays, the editor stamp
    // goes. Same for any future soft references.
    db.prepare("UPDATE pages SET updated_by = NULL WHERE updated_by = ?").run(targetId);
    db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${msg}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
