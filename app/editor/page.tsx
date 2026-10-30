import { redirect } from "next/navigation";
import { getSessionUser, isEditor } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditorIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isEditor(user)) redirect("/");

  const first = db
    .prepare("SELECT id FROM pages ORDER BY collection_id, position, title LIMIT 1")
    .get() as { id: number } | undefined;
  if (first) redirect(`/editor/${first.id}`);
  return null;
}
