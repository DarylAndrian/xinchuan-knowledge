import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db, UserRow, getSetting } from "@/lib/db";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin") redirect("/");

  const users = (
    db.prepare("SELECT * FROM users ORDER BY created_at").all() as unknown as UserRow[]
  ).map((u) => ({ ...u }));
  const settings = {
    site_name: getSetting("site_name", "Xinchuan Knowledge Center"),
    public_viewing: getSetting("public_viewing", "1"),
    open_registration: getSetting("open_registration", "0"),
    comment_approval: getSetting("comment_approval", "0"),
  };

  return <AdminPanel users={users} settings={settings} currentUserId={user.id} />;
}
