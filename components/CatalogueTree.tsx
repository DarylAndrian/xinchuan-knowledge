"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Icon from "./Icon";

export type CatalogueNavNode = {
  id: number;
  title: string;
  href: string;
  draft: boolean;
  children: CatalogueNavNode[];
};

export type CatalogueNavCollection = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  nodes: CatalogueNavNode[];
};

export default function CatalogueTree({ collections }: { collections: CatalogueNavCollection[] }) {
  const pathname = usePathname() || "";

  const renderNodes = (nodes: CatalogueNavNode[], level: number) =>
    nodes.map((node) => (
      <span key={node.id}>
        <Link
          href={node.href}
          scroll={false}
          className={`${level > 0 ? `lvl${Math.min(level + 1, 3)}` : ""} ${pathname === node.href ? "active" : ""}`}
        >
          {node.title}
          {node.draft && <span className="ml-auto text-[10px] text-brass">draft</span>}
        </Link>
        {renderNodes(node.children, level + 1)}
      </span>
    ));

  const navigation = (
    <>
      {collections.map((c) => {
        const collectionHref = `/catalogue/${c.slug}`;
        const activeCollection = pathname === collectionHref || pathname.startsWith(`${collectionHref}/`);
        return (
          <div key={c.id} style={{ marginBottom: 18 }}>
            <div className="sb-label">
              <Icon name={c.icon} size={12} />
              <Link href={collectionHref} scroll={false} className={activeCollection ? "text-ink" : undefined}>
                {c.name}
              </Link>
            </div>
            <nav className="tree">{renderNodes(c.nodes, 0)}</nav>
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
