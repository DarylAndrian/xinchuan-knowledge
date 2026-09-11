import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db, UserRow, CollectionRow, getSetting } from "@/lib/db";
import { listAccessTokens } from "@/lib/tokens";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin") redirect("/");

  const users = (
    db.prepare("SELECT * FROM users ORDER BY created_at").all() as unknown as UserRow[]
  ).map((u) => ({ ...u }));
  const collections = (
    db.prepare("SELECT * FROM collections ORDER BY position, name").all() as unknown as CollectionRow[]
  ).map((c) => ({ ...c }));
  const settings = {
    site_name: getSetting("site_name", "Xinchuan Knowledge Center"),
    open_registration: getSetting("open_registration", "0"),
    comment_approval: getSetting("comment_approval", "0"),
  };
  const tokens = listAccessTokens(user.id);

  return (
    <AdminPanel
      users={users}
      collections={collections}
      settings={settings}
      currentUserId={user.id}
      initialTokens={tokens}
    />
  );
}
