import type { CSSProperties } from "react";

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={`route-skeleton ${className}`} style={style} />;
}

function Status({ label }: { label: string }) {
  return (
    <p className="route-loading-label" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function HomeLoading() {
  return (
    <main className="mx-auto max-w-[860px] px-4 pb-20 pt-10 sm:px-6 sm:pt-16" aria-busy="true" data-route-loading="">
      <Status label="Loading home" />
      <Bone className="h-8 w-[min(100%,420px)]" />
      <Bone className="mt-4 h-4 w-[min(100%,520px)]" />
      <Bone className="mt-2 h-4 w-[min(100%,360px)]" />
      <Bone className="mb-14 mt-6 h-11 w-full" />
      <Bone className="mb-3 h-3 w-28" />
      <div className="flat-list mb-12">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flat-row">
            <Bone className="h-4 w-4 shrink-0" />
            <Bone className="h-4 w-32" />
            <Bone className="h-3.5 min-w-0 flex-1" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
      <Bone className="mb-3 h-3 w-36" />
      <div className="flat-list">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flat-row">
            <Bone className="h-4 w-4 shrink-0" />
            <Bone className="h-4 w-48" />
            <Bone className="ml-auto h-3 w-24" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function CatalogueLoading() {
  return (
    <div className="wiki-layout" aria-busy="true" data-route-loading="">
      <aside className="wiki-sidebar max-[800px]:hidden">
        <Bone className="mb-4 h-3 w-24" />
        {Array.from({ length: 7 }, (_, i) => (
          <Bone key={i} className="mb-2 h-4" style={{ width: `${72 - (i % 3) * 12}%` }} />
        ))}
      </aside>
      <main className="wiki-main">
        <div className="article w-full">
          <Status label="Loading catalogue" />
          <Bone className="mb-6 h-3 w-48" />
          <Bone className="h-9 w-[min(100%,440px)]" />
          <Bone className="mb-8 mt-4 h-3 w-64" />
          <Bone className="mb-3 h-4 w-full" />
          <Bone className="mb-3 h-4 w-[92%]" />
          <Bone className="mb-3 h-4 w-[96%]" />
          <Bone className="mb-3 h-4 w-[80%]" />
          <Bone className="mt-8 h-4 w-full" />
          <Bone className="mt-3 h-4 w-[88%]" />
        </div>
      </main>
      <aside className="wiki-rail max-[1100px]:hidden">
        <Bone className="mb-4 h-3 w-24" />
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="mb-2 h-3" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </aside>
    </div>
  );
}

export function EditorLoading() {
  return (
    <div aria-busy="true" data-route-loading="">
      <Status label="Loading editor" />
      <div className="editor-topbar">
        <Bone className="h-7 w-24" />
        <Bone className="h-4 w-28" />
      </div>
      <div className="admin-layout">
        <aside className="wiki-sidebar max-[800px]:hidden">
          <Bone className="mb-4 h-3 w-28" />
          {Array.from({ length: 8 }, (_, i) => (
            <Bone key={i} className="mb-2 h-4" style={{ width: `${78 - (i % 4) * 10}%` }} />
          ))}
        </aside>
        <main className="editor-main">
          <Bone className="h-10 w-[min(100%,480px)]" />
          <Bone className="mt-4 h-8 w-full" />
          <Bone className="mt-6 h-4 w-full" />
          <Bone className="mt-3 h-4 w-[94%]" />
          <Bone className="mt-3 h-4 w-[86%]" />
          <Bone className="mt-3 h-4 w-[90%]" />
        </main>
        <aside className="inspector max-[1100px]:hidden">
          <Bone className="mb-4 h-3 w-24" />
          <Bone className="mb-3 h-8 w-full" />
          <Bone className="mb-3 h-8 w-full" />
          <Bone className="h-8 w-full" />
        </aside>
      </div>
    </div>
  );
}

export function SearchLoading() {
  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-10 sm:px-6 sm:pt-16" aria-busy="true" data-route-loading="">
      <Status label="Loading search" />
      <Bone className="mb-6 h-7 w-32" />
      <Bone className="mb-8 h-11 w-full" />
      <div className="flat-list">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flat-row">
            <Bone className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <Bone className="h-4 w-48" />
              <Bone className="mt-2 h-3 w-[min(100%,420px)]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function AdminLoading() {
  return (
    <div className="sa-layout" aria-busy="true" data-route-loading="">
      <Status label="Loading admin panel" />
      <aside className="sa-nav max-[720px]:hidden">
        <Bone className="mb-4 h-3 w-24" />
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="mb-2 h-8 w-full" />
        ))}
      </aside>
      <main className="sa-main">
        <Bone className="h-8 w-56" />
        <Bone className="mt-3 h-4 w-[min(100%,480px)]" />
        <Bone className="mt-8 h-40 w-full" />
      </main>
    </div>
  );
}

export function LoginLoading() {
  return (
    <main className="mx-auto max-w-[380px] px-6 py-24" aria-busy="true" data-route-loading="">
      <Status label="Loading sign in" />
      <Bone className="h-8 w-32" />
      <Bone className="mt-3 h-4 w-full" />
      <Bone className="mt-2 h-4 w-[80%]" />
      <Bone className="mt-8 h-10 w-full" />
      <Bone className="mt-3 h-10 w-full" />
      <Bone className="mt-4 h-10 w-full" />
    </main>
  );
}
