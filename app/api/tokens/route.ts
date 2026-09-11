import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/security";
import {
  ALL_SCOPES,
  Scope,
  createAccessToken,
  intersectScopes,
  isScope,
  listAccessTokens,
  scopesForRole,
} from "@/lib/tokens";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    tokens: listAccessTokens(user.id),
    allowed_scopes: scopesForRole(user.role),
    all_scopes: ALL_SCOPES,
  });
}

export async function POST(req: NextRequest) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user || user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const rawScopes = Array.isArray(body.scopes) ? body.scopes.filter(isScope) : [];
  if (rawScopes.length === 0) {
    return NextResponse.json({ error: "Select at least one scope." }, { status: 400 });
  }
  const allowed = new Set(scopesForRole(user.role));
  const requested = (rawScopes as Scope[]).filter((s) => allowed.has(s));
  if (requested.length === 0) {
    return NextResponse.json({ error: "None of the selected scopes are allowed for your role." }, { status: 400 });
  }

  let expiresAt: number | null = null;
  const days = body.expires_in_days;
  if (days !== undefined && days !== null) {
    if (days !== 30 && days !== 90 && days !== 365) {
      return NextResponse.json(
        { error: "expires_in_days must be 30, 90, 365, or omitted." },
        { status: 400 }
      );
    }
    expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  }

  const { token, row } = createAccessToken({
    userId: user.id,
    name,
    scopes: requested,
    ownerRole: user.role,
    expiresAt,
  });
  return NextResponse.json({ token, ...row }, { status: 201 });
}
