import Link from "next/link";
import { FileText, Search } from "lucide-react";
import Icon from "@/components/Icon";
import {
  getCollections,
  countPages,
  getRecentPages,
  getCollectionPages,
  hrefForPage,
  timeAgo,
} from "@/lib/pages";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const collections = getCollections();
  const recent = getRecentPages(6);

  return (
    <main className="mx-auto max-w-[860px] px-6 pb-20 pt-16">
      <h1 className="text-[30px] font-semibold tracking-tight">Xinchuan Knowledge Center</h1>
      <p className="mb-6 mt-2 max-w-[58ch] text-[15px] text-ink-muted">
        One place for everything we know — guides, standards, runbooks and documents. If it isn’t
        written down here, it doesn’t exist yet.
      </p>

      <Link
        href="/search"
        className="mb-14 flex items-center gap-2.5 rounded border border-rule-strong bg-canvas px-4 py-[11px] text-[14px] text-ink-muted transition-colors hover:border-moss"
      >
        <Search size={15} />
        Try “deployment checklist”, “payment options”, “onboarding”…
        <span className="ml-auto rounded border border-rule px-1.5 text-[10.5px]">⌘K</span>
      </Link>

      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.07em] text-ink-muted">
        Collections
      </div>
      <div className="flat-list mb-12">
        {collections.map((c) => (
          <Link key={c.id} href={`/catalogue/${c.slug}`} className="flat-row">
            <span className="row-icon">
              <Icon name={c.icon} />
            </span>
            <b>{c.name}</b>
            <span className="desc">{c.description}</span>
            <span className="count">{countPages(c.id)} pages</span>
          </Link>
        ))}
        {collections.length === 0 && (
          <div className="flat-row text-ink-muted">No collections yet — create one in the Editor.</div>
        )}
      </div>

      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.07em] text-ink-muted">
        Recently updated
      </div>
      <div className="flat-list">
        {recent.map((p) => {
          const href = hrefForPage(p.collection_slug, getCollectionPages(p.collection_id), p.id);
          return (
            <Link key={p.id} href={href} className="flat-row">
              <span className="row-icon">
                <FileText size={15} />
              </span>
              <b>{p.title}</b>
              <span className="crumb">
                {p.collection_name}
              </span>
              <span className="count brass-mark" style={{ marginLeft: "auto" }}>
                edited {timeAgo(p.updated_at)}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
