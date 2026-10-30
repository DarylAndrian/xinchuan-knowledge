import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, isEditor } from "@/lib/auth";
import { db, CollectionRow, PageRow } from "@/lib/db";
import EditorShell from "@/components/EditorShell";
import { EditorLoading } from "@/components/RouteLoading";

export const dynamic = "force-dynamic";

async function EditorFrame() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isEditor(user)) redirect("/");

  const collections = (
    db.prepare("SELECT * FROM collections ORDER BY position, name").all() as unknown as CollectionRow[]
  ).map((c) => ({ ...c }));
  const pages = (
    db.prepare("SELECT * FROM pages ORDER BY collection_id, position, title").all() as unknown as PageRow[]
  ).map((p) => ({ ...p }));

  return (
    <EditorShell
      collections={collections}
      pages={pages}
      userId={user.id}
      isSuperadmin={user.role === "superadmin"}
    />
  );
}

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<EditorLoading />}>
        <EditorFrame />
      </Suspense>
      {children}
    </>
  );
}
