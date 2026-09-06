import Link from "next/link";
import Icon from "./Icon";
import { getCollections, getCollectionPages, buildTree, TreeNode } from "@/lib/pages";
import { isEditor, SessionUser } from "@/lib/auth";
import { Menu } from "lucide-react";

export default function CatalogueSidebar({
  activeHref,
  user,
}: {
  activeHref: string;
  user: SessionUser | null;
}) {
  const collections = getCollections();
  const editor = isEditor(user);

  const renderNodes = (nodes: TreeNode[], collectionSlug: string, prefix: string, level: number) =>
    nodes.map(({ page, children }) => {
      const href = `/catalogue/${collectionSlug}/${prefix}${page.slug}`;
      const visible = page.status === "published" || editor;
      if (!visible) return null;
      return (
        <span key={page.id}>
          <Link href={href} className={`${level > 0 ? `lvl${Math.min(level + 1, 3)}` : ""} ${href === activeHref ? "active" : ""}`}>
            {page.title}
            {page.status === "draft" && <span className="ml-auto text-[10px] text-brass">draft</span>}
          </Link>
          {renderNodes(children, collectionSlug, `${prefix}${page.slug}/`, level + 1)}
        </span>
      );
    });

  const navigation = (
    <>
      {collections.map((c) => {
        const pages = getCollectionPages(c.id);
        const tree = buildTree(pages);
        return (
          <div key={c.id} style={{ marginBottom: 18 }}>
            <div className="sb-label">
              <Icon name={c.icon} size={12} />
              <Link href={`/catalogue/${c.slug}`}>{c.name}</Link>
            </div>
            <nav className="tree">{renderNodes(tree, c.slug, "", 0)}</nav>
          </div>
        );
      })}
    </>
  );

  return (
    <>
      <details className="wiki-mobile-drawer">
        <summary><Menu size={15} /> Browse pages</summary>
        <div className="wiki-mobile-drawer-panel">{navigation}</div>
      </details>
      <aside className="wiki-sidebar">{navigation}</aside>
    </>
  );
}
