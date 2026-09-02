import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { searchPages, textSnippet, getCollectionPages, hrefForPage, timeAgo } from "@/lib/pages";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim();
  const results = query ? searchPages(query) : [];

  return (
    <main className="mx-auto max-w-[760px] px-6 pb-20 pt-16">
      <h1 className="mb-6 text-[24px] font-semibold tracking-tight">Search</h1>

      <form action="/search" method="GET" className="mb-8">
        <div className="flex items-center gap-2 rounded border border-rule-strong bg-canvas px-4 py-[10px] transition-colors focus-within:border-moss">
          <Search size={15} className="shrink-0 text-ink-muted" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search published pages…"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-muted"
            autoFocus
          />
          <button type="submit" className="btn btn-sm">
            Search
          </button>
        </div>
      </form>

      {query && (
        <p className="mb-3 text-[13px] text-ink-muted">
          {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
        </p>
      )}

      <div className="flat-list">
        {results.map((p) => {
          const href = hrefForPage(p.collection_slug, getCollectionPages(p.collection_id), p.id);
          return (
            <Link key={p.id} href={href} className="flat-row" style={{ alignItems: "flex-start" }}>
              <span className="row-icon" style={{ marginTop: 2 }}>
                <FileText size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <b>{p.title}</b>
                <div className="mt-0.5 text-[13px] text-ink-muted">
                  {textSnippet(p.content_html, query)}
                </div>
              </div>
              <span className="count">
                {p.collection_name} · {timeAgo(p.updated_at)}
              </span>
            </Link>
          );
        })}
        {query && results.length === 0 && (
          <div className="flat-row text-ink-muted">Nothing found. Try different keywords.</div>
        )}
      </div>
    </main>
  );
}
