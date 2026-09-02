"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, TextQuote, CodeXml, Table, Minus,
  Undo2, Redo2, Check, Eye, Plus, Trash2, ExternalLink,
} from "lucide-react";
import Icon from "./Icon";
import { editorExtensions } from "@/lib/extensions";
import type { CollectionRow, PageRow } from "@/lib/db";

interface Props {
  collections: CollectionRow[];
  pages: PageRow[];
  userId: number;
}

type SaveState = "saved" | "dirty" | "saving";

export default function EditorShell({ collections: initialCollections, pages: initialPages, userId }: Props) {
  const [collections, setCollections] = useState(initialCollections);
  const [pages, setPages] = useState(initialPages);
  const [selectedId, setSelectedId] = useState<number | null>(initialPages[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextUpdate = useRef(false);

  const selected = pages.find((p) => p.id === selectedId) || null;

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    immediatelyRender: false,
    onUpdate: () => scheduleSave(),
  });

  /* ----- load selection into editor ----- */
  useEffect(() => {
    if (!selected || !editor) return;
    setTitle(selected.title);
    skipNextUpdate.current = true;
    try {
      const json = JSON.parse(selected.content_json || "{}");
      editor.commands.setContent(json && json.type ? json : "", false);
    } catch {
      editor.commands.setContent("", false);
    }
    setSaveState("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editor]);

  /* ----- autosave ----- */
  const scheduleSave = useCallback(() => {
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, title]);

  async function saveNow() {
    if (!selected || !editor) return;
    setSaveState("saving");
    const res = await fetch(`/api/pages/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content_json: JSON.stringify(editor.getJSON()),
        content_html: editor.getHTML(),
      }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PageRow;
      setPages((ps) => ps.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setSaveState("saved");
    } else {
      setSaveState("dirty");
    }
  }

  /* ----- actions ----- */
  async function createPage(collectionId: number, parentId: number | null) {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection_id: collectionId, parent_id: parentId, title: "Untitled" }),
    });
    if (!res.ok) return;
    const page = (await res.json()) as PageRow;
    setPages((ps) => [...ps, page]);
    setSelectedId(page.id);
  }

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const collection = (await res.json()) as CollectionRow;
    setCollections((cs) => [...cs, collection]);
    setNewCollectionName("");
    setShowNewCollection(false);
    await createPage(collection.id, null);
  }

  async function togglePublish() {
    if (!selected) return;
    const status = selected.status === "published" ? "draft" : "published";
    const res = await fetch(`/api/pages/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PageRow;
      setPages((ps) => ps.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    }
  }

  async function deletePage() {
    if (!selected || !confirm(`Delete “${selected.title}” and all its sub-pages?`)) return;
    await fetch(`/api/pages/${selected.id}`, { method: "DELETE" });
    const remaining = pages.filter((p) => p.id !== selected.id && p.parent_id !== selected.id);
    setPages(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  }

  async function movePage(parentId: number | null) {
    if (!selected) return;
    const res = await fetch(`/api/pages/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PageRow;
      setPages((ps) => ps.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    }
  }

  /* ----- derived tree ----- */
  const treeByCollection = useMemo(() => {
    const map = new Map<number, Array<{ page: PageRow; depth: number }>>();
    for (const c of collections) {
      const rows = pages.filter((p) => p.collection_id === c.id);
      const out: Array<{ page: PageRow; depth: number }> = [];
      const walk = (parentId: number | null, depth: number) => {
        for (const p of rows.filter((r) => (r.parent_id ?? null) === parentId)) {
          out.push({ page: p, depth });
          walk(p.id, depth + 1);
        }
      };
      walk(null, 0);
      map.set(c.id, out);
    }
    return map;
  }, [collections, pages]);

  const viewHref = useMemo(() => {
    if (!selected) return "#";
    const coll = collections.find((c) => c.id === selected.collection_id);
    if (!coll) return "#";
    const chain: PageRow[] = [];
    let cur: PageRow | undefined = selected;
    while (cur) {
      chain.unshift(cur);
      cur = pages.find((p) => p.id === cur!.parent_id);
    }
    return `/catalogue/${coll.slug}/${chain.map((p) => p.slug).join("/")}`;
  }, [selected, collections, pages]);

  const parentOptions = selected
    ? pages.filter((p) => p.collection_id === selected.collection_id && p.id !== selected.id)
    : [];

  const toolbarBtn = (
    onClick: () => void,
    active: boolean,
    icon: React.ReactNode,
    label: string
  ) => (
    <button type="button" onClick={onClick} className={active ? "is-active" : ""} title={label} aria-label={label}>
      {icon}
    </button>
  );

  return (
    <>
      <div className="editor-topbar">
        <div className={`save-state ${saveState !== "saved" ? "dirty" : ""}`}>
          <Check size={13} />
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Unsaved changes"}
        </div>
        <span style={{ color: "var(--rule)" }}>|</span>
        <button className="btn btn-ghost btn-sm" onClick={() => editor?.chain().focus().undo().run()} aria-label="Undo">
          <Undo2 size={13} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => editor?.chain().focus().redo().run()} aria-label="Redo">
          <Redo2 size={13} />
        </button>
        <span style={{ marginLeft: "auto" }}>
          {selected && (
            <Link href={viewHref} className="flex items-center gap-1.5 text-moss hover:text-moss-hover">
              <ExternalLink size={12} /> View page
            </Link>
          )}
        </span>
      </div>

      <div className="admin-layout">
        {/* left: tree navigator */}
        <aside className="wiki-sidebar" style={{ position: "static", maxHeight: "none" }}>
          {collections.map((c) => (
            <div key={c.id} style={{ marginBottom: 16 }}>
              <div className="sb-label">
                <Icon name={c.icon} size={12} /> {c.name}
                <button
                  onClick={() => createPage(c.id, null)}
                  style={{ marginLeft: "auto", background: "none", border: 0, cursor: "pointer", color: "var(--ink-muted)" }}
                  title="New page in this collection"
                >
                  <Plus size={12} />
                </button>
              </div>
              <nav className="tree">
                {(treeByCollection.get(c.id) || []).map(({ page, depth }) => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedId(page.id)}
                    className={`${depth === 1 ? "lvl2" : depth >= 2 ? "lvl3" : ""} ${page.id === selectedId ? "active" : ""}`}
                  >
                    <span className="truncate">{page.title}</span>
                    {page.status === "draft" && (
                      <span className="ml-auto text-[10px]" style={{ color: page.id === selectedId ? "var(--canvas)" : "var(--brass)" }}>
                        draft
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          ))}

          {showNewCollection ? (
            <div style={{ padding: "0 10px" }}>
              <input
                autoFocus
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCollection()}
                placeholder="Collection name…"
                className="w-full rounded border border-rule-strong bg-canvas px-2 py-1 text-[12.5px] outline-none focus:border-moss"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button className="btn btn-primary btn-sm" onClick={createCollection}>Create</button>
                <button className="btn btn-sm" onClick={() => setShowNewCollection(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="sb-label w-full cursor-pointer hover:text-ink" onClick={() => setShowNewCollection(true)}>
              <Plus size={12} /> New collection
            </button>
          )}
        </aside>

        {/* center: editor */}
        <main className="editor-main">
          {selected && editor ? (
            <div className="editor-col">
              <input
                className="editor-title-input"
                value={title}
                placeholder="Untitled"
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave();
                }}
              />
              <div className="editor-meta">
                {collections.find((c) => c.id === selected.collection_id)?.name} · slug: {selected.slug}
                <span className={selected.status === "published" ? "text-moss" : "text-brass"}>
                  · {selected.status}
                </span>
              </div>

              <div className="editor-toolbar">
                {toolbarBtn(() => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), <Bold size={14} />, "Bold")}
                {toolbarBtn(() => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), <Italic size={14} />, "Italic")}
                {toolbarBtn(() => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), <Strikethrough size={14} />, "Strikethrough")}
                <span className="sep" />
                {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }), <Heading1 size={14} />, "Heading 1")}
                {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), <Heading2 size={14} />, "Heading 2")}
                {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), <Heading3 size={14} />, "Heading 3")}
                <span className="sep" />
                {toolbarBtn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), <List size={14} />, "Bullet list")}
                {toolbarBtn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), <ListOrdered size={14} />, "Numbered list")}
                {toolbarBtn(() => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"), <ListChecks size={14} />, "To-do list")}
                <span className="sep" />
                {toolbarBtn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), <TextQuote size={14} />, "Callout / quote")}
                {toolbarBtn(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"), <CodeXml size={14} />, "Code block")}
                {toolbarBtn(
                  () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
                  editor.isActive("table"),
                  <Table size={14} />,
                  "Insert table"
                )}
                {toolbarBtn(() => editor.chain().focus().setHorizontalRule().run(), false, <Minus size={14} />, "Divider")}
              </div>

              <EditorContent editor={editor} className="tiptap-wrap" />
            </div>
          ) : (
            <div className="editor-col text-[14px] text-ink-muted">
              Select a page on the left, or create a new one with the <Plus size={12} style={{ display: "inline" }} /> button.
            </div>
          )}
        </main>

        {/* right: inspector */}
        <aside className="inspector">
          {selected ? (
            <>
              <h4>Page settings</h4>
              <div className="field">
                <label>Status</label>
                <div className="switch-row" style={{ borderTop: 0, padding: "4px 0" }}>
                  {selected.status === "published" ? "Published" : "Draft"}
                  <button
                    className={`switch ${selected.status === "published" ? "" : "off"}`}
                    onClick={togglePublish}
                    aria-label="Toggle publish"
                  />
                </div>
              </div>
              <div className="field">
                <label>Parent page</label>
                <select
                  value={selected.parent_id ?? ""}
                  onChange={(e) => movePage(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(none — top level)</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <h4>Visibility</h4>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {selected.status === "published"
                  ? "Anyone can read this page in the Catalogue."
                  : "Only admins can see this page. Publish to make it public."}
              </p>

              <h4>Danger zone</h4>
              <button className="btn btn-danger btn-sm" onClick={deletePage}>
                <Trash2 size={12} /> Delete page
              </button>
            </>
          ) : (
            <p className="text-[12.5px] text-ink-muted">No page selected.</p>
          )}
        </aside>
      </div>
    </>
  );
}
