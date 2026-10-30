import type { ReactNode } from "react";
import CatalogueSidebar from "@/components/CatalogueSidebar";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CatalogueLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="wiki-layout">
      <CatalogueSidebar user={user} />
      {children}
    </div>
  );
}
