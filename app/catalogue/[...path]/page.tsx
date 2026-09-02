import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import CatalogueSidebar from "@/components/CatalogueSidebar";
import PageReader from "@/components/PageReader";
import { getSessionUser, isEditor } from "@/lib/auth";
import { db, getSetting } from "@/lib/db";
import { getComments, countThreads } from "@/lib/comments";
import {
  resolvePath,
  getCollectionPages,
  buildTree,
  timeAgo,
} from "@/lib/pages";

export const dynamic = "force-dynamic";

export default async function CataloguePathPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const user = await getSessionUser();
  const editor = isEditor(user);
  const publicViewing = getSetting("public_viewing", "1") === "1";
  if (!publicViewing && !user) redirect("/login");

  // /catalogue/<collection> → jump to first page of that collection
  if (path.length === 1) {
    const row = db.prepare("SELECT id FROM collections WHERE slug = ?").get(path[0]) as
      | { id: number }
      | undefined;
    const pages = row ? getCollectionPages(row.id) : [];
    const first = buildTree(pages).find((n) => n.page.status === "published" || editor);
    if (first) redirect(`/catalogue/${path[0]}/${first.page.slug}`);
    notFound();
  }

  const resolved = resolvePath(path);
  if (!resolved) notFound();
  const { collection, page, ancestors } = resolved;

  if (page.status !== "published" && !editor) notFound();

  const comments = getComments(page.id);
  const threadCount = countThreads(page.id);
  const editorName = page.updated_by
    ? ((db.prepare("SELECT name FROM users WHERE id = ?").get(page.updated_by) as { name: string } | undefined)?.name ?? "—")
    : "—";

  const canComment = !!user; // commentator and above
  const canModerate = editor;

  return (
    <div className="wiki-layout">
      <CatalogueSidebar activeHref={`/catalogue/${path.join("/")}`} user={user} />

      <PageReader
        html={page.content_html}
        pageId={page.id}
        comments={comments}
        canComment={canComment}
        canModerate={canModerate}
        currentUserId={user?.id ?? null}
      >
        <div className="breadcrumbs">
          <Link href={`/catalogue/${collection.slug}`}>{collection.name}</Link>
          {ancestors.map((a, i) => (
            <span key={a.id} className="flex items-center gap-[7px]">
              <span>/</span>
              <Link href={`/catalogue/${path.slice(0, i + 2).join("/")}`}>{a.title}</Link>
            </span>
          ))}
          <span>/</span>
          <span>{page.title}</span>
        </div>

        {page.status === "draft" && (
          <div className="mb-4 border-l-2 border-brick bg-surface px-4 py-2 text-[13px] text-brick">
            Draft — visible to editors only. Publish it from the Editor to make it public.
          </div>
        )}

        <h1 className="page-title">{page.title}</h1>
        <div className="page-meta">
          <span>Edited by {editorName}</span>
          <span className="brass-mark">{timeAgo(page.updated_at)}</span>
          <span className="flex items-center gap-1.5">
            <MessageSquare size={12} /> {threadCount} comment{threadCount === 1 ? "" : "s"}
          </span>
        </div>
      </PageReader>
    </div>
  );
}
