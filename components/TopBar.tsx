"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Shield, LogOut, ChevronDown } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export default function TopBar({
  user,
  siteName,
  version,
}: {
  user: SessionUser | null;
  siteName: string;
  version: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canEdit = !!user && (user.role === "admin" || user.role === "superadmin");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const navLink = (href: string, label: string) => {
    const active = href === "/" ? pathname === "/" : (pathname ?? "").startsWith(href);
    return (
      <Link
        href={href}
        className={`relative rounded px-2.5 py-1 text-[13.5px] font-medium transition-colors ${
          active
            ? "text-moss after:absolute after:bottom-[-13px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-moss"
            : "text-ink-muted hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  const initials = user
    ? user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-canvas">
      <div className="mx-auto flex h-[52px] max-w-[1360px] items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 text-[14.5px] font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded border-[1.5px] border-ink text-[12px] font-bold">
            X
          </span>
          {siteName}
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {navLink("/", "Home")}
          {navLink("/catalogue", "Catalogue")}
          {canEdit && navLink("/editor", "Editor")}
        </nav>

        <Link
          href="/search"
          className="ml-auto flex max-w-[300px] flex-1 items-center gap-2 rounded border border-rule-strong px-3 py-[5px] text-[13px] text-ink-muted transition-colors hover:border-moss"
        >
          <Search size={14} />
          Search…
          <span className="ml-auto rounded border border-rule bg-canvas px-1.5 text-[10.5px]">⌘K</span>
        </Link>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded p-1 hover:bg-surface"
              aria-label="Profile menu"
            >
              <span className="grid h-[26px] w-[26px] place-items-center rounded-full border border-rule-strong bg-surface text-[10.5px] font-semibold text-ink-muted">
                {initials}
              </span>
              <ChevronDown size={13} className="text-ink-muted" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-56 rounded border border-rule-strong bg-canvas py-1.5 shadow-none">
                <div className="border-b border-rule px-3 pb-2 pt-1">
                  <div className="text-[13px] font-semibold">{user.name}</div>
                  <div className="text-[12px] text-ink-muted">{user.username}</div>
                  <span className="role-mark role-admin mt-1 inline-block">{user.role}</span>
                </div>
                {user.role === "superadmin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink hover:bg-surface"
                  >
                    <Shield size={14} className="text-ink-muted" /> Admin panel
                  </Link>
                )}
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-surface"
                >
                  <LogOut size={14} className="text-ink-muted" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="btn">
            Sign in
          </Link>
        )}
        <span className="shrink-0 text-[11px] tabular-nums text-ink-muted" title={`Xinchuan Knowledge Center v${version}`}>
          v{version}
        </span>
      </div>
    </header>
  );
}
