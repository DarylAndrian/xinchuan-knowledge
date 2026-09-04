import { redirect } from "next/navigation";
import { getSessionUser, isEditor } from "@/lib/auth";
import { db, CollectionRow, PageRow } from "@/lib/db";
import EditorShell from "@/components/EditorShell";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isEditor(user)) redirect("/");

  const collections = (
    db.prepare("SELECT * FROM collections ORDER BY position, name").all() as unknown as CollectionRow[]
  ).map((c) => ({ ...c }));
  const pages = (
    db.prepare("SELECT * FROM pages ORDER BY collection_id, position, title").all() as unknown as PageRow[]
  ).map((p) => ({ ...p }));

  return <EditorShell collections={collections} pages={pages} userId={user.id} isSuperadmin={user.role === "superadmin"} />;
}
