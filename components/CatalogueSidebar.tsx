import CatalogueTree, { CatalogueNavNode } from "./CatalogueTree";
import { getCollections, getCollectionPages, buildTree, TreeNode } from "@/lib/pages";
import { isEditor, SessionUser } from "@/lib/auth";

function toNodes(nodes: TreeNode[], collectionSlug: string, prefix: string, editor: boolean): CatalogueNavNode[] {
  const out: CatalogueNavNode[] = [];
  for (const { page, children } of nodes) {
    if (page.status !== "published" && !editor) continue;
    const href = `/catalogue/${collectionSlug}/${prefix}${page.slug}`;
    out.push({
      id: page.id,
      title: page.title,
      href,
      draft: page.status === "draft",
      children: toNodes(children, collectionSlug, `${prefix}${page.slug}/`, editor),
    });
  }
  return out;
}

export default function CatalogueSidebar({ user }: { user: SessionUser | null }) {
  const editor = isEditor(user);
  const collections = getCollections().map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    nodes: toNodes(buildTree(getCollectionPages(c.id)), c.slug, "", editor),
  }));

  return <CatalogueTree collections={collections} />;
}
