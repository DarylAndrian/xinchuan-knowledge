import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { getCollections, searchPages, timeAgo } from "@/lib/pages";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; collection?: string }>;
}) {
  const { q, collection } = await searchParams;
  await requireUser();
  const query = (q || "").trim();
  const selected = (collection || "").trim();
  const collections = getCollections();
  const selectedCollection = collections.find(
    (c) =>
      String(c.id) === selected ||
      c.name.toLowerCase() === selected.toLowerCase() ||
      c.slug.toLowerCase() === selected.toLowerCase()
  );
  const results = query ? searchPages(query, { collection: selected || undefined, limit: 20 }) : [];

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
      <h1 className="mb-6 text-[22px] font-semibold tracking-tight sm:text-[24px]">Search</h1>

      <form action="/search" method="GET" className="mb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-rule-strong bg-canvas px-4 py-[10px] transition-colors focus-within:border-moss">
            <Search size={15} className="shrink-0 text-ink-muted" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search published pages…"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-muted"
              autoFocus
            />
          </div>
          <select
            name="collection"
            defaultValue={selectedCollection?.name || ""}
            aria-label="Collection"
            className="h-[42px] rounded border border-rule-strong bg-canvas px-3 text-[14px] text-ink outline-none focus:border-moss sm:max-w-[220px]"
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn">
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
        {results.map((p, index) => (
          <Link key={`${p.id}-${p.anchor}-${index}`} href={p.href} className="flat-row" style={{ alignItems: "flex-start" }}>
            <span className="row-icon" style={{ marginTop: 2 }}>
              <FileText size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <b>{p.title}</b>
              {p.section ? <div className="text-[12.5px] text-moss">{p.section}</div> : null}
              {p.snippet ? <div className="mt-0.5 text-[13px] text-ink-muted">{p.snippet}</div> : null}
            </div>
            <span className="count">
              {p.collection_name} · {timeAgo(p.updated_at)}
            </span>
          </Link>
        ))}
        {query && results.length === 0 && (
          <div className="flat-row text-ink-muted">Nothing found. Try different keywords.</div>
        )}
      </div>
    </main>
  );
}
