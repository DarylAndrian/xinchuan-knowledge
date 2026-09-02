import { redirect } from "next/navigation";
import { firstPublished } from "@/lib/pages";

export const dynamic = "force-dynamic";

export default function CatalogueIndex() {
  const first = firstPublished();
  if (first) {
    redirect(`/catalogue/${first.collection.slug}/${first.page.slug}`);
  }
  return (
    <main className="mx-auto max-w-[760px] px-6 py-24 text-center">
      <h1 className="text-[24px] font-semibold">Catalogue</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Nothing published yet. Create and publish pages in the Editor.
      </p>
    </main>
  );
}
