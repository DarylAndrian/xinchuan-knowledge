import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, UserRow, Role } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const ROLES: Role[] = ["superadmin", "admin", "commentator"];

function isSuperadmin(user: Awaited<ReturnType<typeof getSessionUser>>) {
  return !!user && user.role === "superadmin";
}

export async function GET() {
  const user = await getSessionUser();
  if (!isSuperadmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = db.prepare("SELECT * FROM users ORDER BY created_at").all() as unknown as UserRow[];
  return NextResponse.json(users.map(({ password_hash, ...rest }) => rest));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!isSuperadmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const role: Role = ROLES.includes(body.role) ? body.role : "commentator";

  if (!email || !name || password.length < 6) {
    return NextResponse.json(
      { error: "Name, email and a password of 6+ characters are required." },
      { status: 400 }
    );
  }
  if (db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email)) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const info = db
    .prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(email, name, bcrypt.hashSync(password, 10), role);

  const created = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(info.lastInsertRowid)) as unknown as UserRow;
  const { password_hash, ...safe } = created;
  return NextResponse.json(safe, { status: 201 });
}
