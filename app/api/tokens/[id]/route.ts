import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/security";
import { revokeAccessToken } from "@/lib/tokens";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user || user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const tokenId = Number(id);
  if (!Number.isFinite(tokenId)) {
    return NextResponse.json({ error: "Invalid token id." }, { status: 400 });
  }
  const removed = revokeAccessToken(user.id, tokenId);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
