"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, TextQuote, CodeXml, Table, Minus,
  Undo2, Redo2, Check, Eye, Plus, Trash2, ExternalLink, Pencil, X, Link2, ImagePlus, MoreHorizontal,
  History, RotateCcw, Menu,
  ArrowUpFromLine, ArrowDownFromLine, ArrowLeftFromLine, ArrowRightFromLine,
  ListMinus, PaintBucket, SquareDashed, Baseline, TableCellsMerge, TableCellsSplit, ChevronDown,
  AlignVerticalSpaceAround,
} from "lucide-react";
import Icon, { IconPicker } from "./Icon";
import { editorExtensions } from "@/lib/extensions";
import { clipboardTextSerializer } from "@/lib/clipboard";
import { BULLET_STYLE_OPTIONS, ORDERED_STYLE_OPTIONS } from "@/lib/list-styles";
import {
  applyTableBackground,
  canDeleteCurrentColumn,
  canDeleteCurrentRow,
  tableHasContent,
  type BackgroundScope,
} from "@/lib/table-utils";
import { resolveImageUrl, isSharePageUrl } from "@/lib/images";
import {
  LINE_SPACING_PRESETS,
  blockSpacingAt,
  displayLineHeight,
  setBlockSpacing,
  type SpacingPatch,
} from "@/lib/line-spacing";
import type { CollectionRow, PageRow } from "@/lib/db";

interface Props {
  collections: CollectionRow[];
  pages: PageRow[];
  userId: number;
  isSuperadmin?: boolean;
}

type SaveState = "saved" | "dirty" | "saving";

const STALE_PAGE_MESSAGE = "This page was changed elsewhere, reload to see the latest";

function editorContentFromPage(page: Pick<PageRow, "content_json" | "content_html">): object | string {
  const raw = (page.content_json || "").trim();
  if (raw && raw !== "{}" && raw !== "null") {
    try {
      const json = JSON.parse(raw) as { type?: unknown };
      if (json && typeof json === "object" && json.type) return json;
    } catch {
      /* HTML below is the readable copy. */
    }
  }
  return page.content_html?.trim() ? page.content_html : "";
}

type PatchResult =
  | { ok: true; page: PageRow }
  | { ok: false; stale: true }
  | { ok: false; stale: false; error: string };

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent);
}

function editorHint(label: string, combo?: string, mod = "Ctrl") {
  return combo ? `${mod}+${combo} = ${label}` : label;
}

type RevisionSummary = {
  id: number;
  page_id: number;
  title: string;
  status: "draft" | "published";
  created_at: string;
  created_by: number | null;
  editor_name?: string;
};

export default function EditorShell({ collections: initialCollections, pages: initialPages, userId, isSuperadmin = false }: Props) {
  const [collections, setCollections] = useState(initialCollections);
  const [pages, setPages] = useState(initialPages);
  const [selectedId, setSelectedId] = useState<number | null>(initialPages[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionIcon, setNewCollectionIcon] = useState("book");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [working, setWorking] = useState<
    | "page"
    | "collection"
    | "collection-save"
    | "collection-delete"
    | "publish"
    | "slug"
    | "delete"
    | "move"
    | "restore"
    | null
  >(null);
  const menuRef = useRef<HTMLSpanElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fresh-value mirrors: the debounced saver must read these, never render
  // closures — otherwise a keystroke's save sends the pre-keystroke (-1) title.
  const titleRef = useRef("");
  const selectedIdRef = useRef<number | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const slugTouchedRef = useRef(false);
  const pendingSave = useRef<{ pageId: number; title: string } | null>(null);
  const loadedUpdatedAtRef = useRef<string | null>(null);
  const saveBlockedRef = useRef(false);
  const writeChain = useRef<Promise<void>>(Promise.resolve());
  const performSaveRef = useRef<() => Promise<void>>(async () => {});
  const saveNowRef = useRef<() => Promise<void>>(async () => {});
  const workingRef = useRef(false);
  const [modKey, setModKey] = useState("Ctrl");
  const [treeOpen, setTreeOpen] = useState(false);
  const [showFontColor, setShowFontColor] = useState(false);
  const [fontColor, setFontColor] = useState("#A6483A");
  const fontColorRef = useRef<HTMLDivElement | null>(null);
  const [listMenu, setListMenu] = useState<null | "bullet" | "ordered">(null);
  const bulletMenuRef = useRef<HTMLDivElement | null>(null);
  const orderedMenuRef = useRef<HTMLDivElement | null>(null);
  const [showLineSpacing, setShowLineSpacing] = useState(false);
  const [customSpacing, setCustomSpacing] = useState("1.15");
  const lineSpacingRef = useRef<HTMLDivElement | null>(null);
  const spacingRangeRef = useRef<{ from: number; to: number } | null>(null);
  const [tableUi, setTableUi] = useState({
    active: false,
    canDelRow: false,
    canDelCol: false,
    canMerge: false,
    canSplit: false,
    customColor: "#4B5D45",
    scope: "cell" as BackgroundScope,
  });

  useEffect(() => {
    if (isApplePlatform()) setModKey("Cmd");
  }, []);

  const selected = pages.find((p) => p.id === selectedId) || null;

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    immediatelyRender: false,
    editorProps: { clipboardTextSerializer },
    onUpdate: () => {
      scheduleSave();
      refreshTableUi();
    },
  });

  function refreshTableUi() {
    const ed = editorRef.current;
    if (!ed) {
      setTableUi((s) => (s.active ? { ...s, active: false } : s));
      return;
    }
    const active = ed.isActive("table");
    setTableUi((s) => {
      if (!active) {
        if (!s.active && !s.canMerge && !s.canSplit) return s;
        return { ...s, active: false, canDelRow: false, canDelCol: false, canMerge: false, canSplit: false };
      }
      const canDelRow = canDeleteCurrentRow(ed);
      const canDelCol = canDeleteCurrentColumn(ed);
      const canMerge = ed.can().mergeCells();
      const canSplit = ed.can().splitCell();
      if (
        s.active === active &&
        s.canDelRow === canDelRow &&
        s.canDelCol === canDelCol &&
        s.canMerge === canMerge &&
        s.canSplit === canSplit
      ) return s;
      return { ...s, active, canDelRow, canDelCol, canMerge, canSplit };
    });
  }

  useEffect(() => {
    if (!editor) return;
    const update = () => refreshTableUi();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Mirror render values for the debounced saver (see refs above).
  titleRef.current = title;
  selectedIdRef.current = selectedId;
  editorRef.current = editor;

  /* ----- load selection into editor ----- */
  useEffect(() => {
    if (!selected || !editor) return;
    setTitle(selected.title);
    setSlugInput(selected.slug);
    setSlugError(null);
    slugTouchedRef.current = false;
    loadedUpdatedAtRef.current = selected.updated_at;
    saveBlockedRef.current = false;
    setStale(false);
    setSaveError(null);
    editor.commands.setContent(editorContentFromPage(selected), { emitUpdate: false });
    setSaveState("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editor]);

  useEffect(() => {
    setShowHistory(false);
    setRevisions([]);
    setHistoryError(null);
  }, [selectedId]);

  /* ----- autosave (snapshot fresh values; never render closures) ----- */
  const scheduleSave = useCallback(() => {
    if (saveBlockedRef.current) return;
    const pageId = selectedIdRef.current;
    if (pageId == null) return;
    setSaveState("dirty");
    pendingSave.current = { pageId, title: titleRef.current };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveNowRef.current(), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markConflict() {
    saveBlockedRef.current = true;
    pendingSave.current = null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setStale(true);
    setSaveError(STALE_PAGE_MESSAGE);
    setSaveState("saved");
  }

  function rememberVersion(page: PageRow) {
    if (page.id === selectedIdRef.current) loadedUpdatedAtRef.current = page.updated_at;
    setPages((ps) => ps.map((p) => (p.id === page.id ? { ...p, ...page } : p)));
    if (!slugTouchedRef.current && page.id === selectedIdRef.current) setSlugInput(page.slug);
  }

  async function performSave() {
    if (saveBlockedRef.current) return;
    const pending = pendingSave.current;
    const ed = editorRef.current;
    if (!pending || !ed) return;
    pendingSave.current = null;
    setSaveState("saving");
    const res = await fetch(`/api/pages/${pending.pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: pending.title,
        content_json: JSON.stringify(ed.getJSON()),
        content_html: ed.getHTML(),
        expected_updated_at: loadedUpdatedAtRef.current,
        source: "editor",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.code === "stale_page") {
      markConflict();
      return;
    }
    if (res.ok) {
      rememberVersion(data as PageRow);
      setSaveError(null);
      setSaveState(pendingSave.current ? "dirty" : "saved");
      return;
    }
    setSaveError(data.error || "Could not save. Please try again.");
    setSaveState("dirty");
  }

  function enqueueWrite(task?: () => Promise<void> | void): Promise<void> {
    const run = writeChain.current.then(async () => {
      if (task) await task();
      else await performSaveRef.current();
    });
    writeChain.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async function saveNow() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await enqueueWrite();
  }

  performSaveRef.current = performSave;
  saveNowRef.current = saveNow;

  async function patchPage(pageId: number, body: Record<string, unknown>): Promise<PatchResult> {
    let result: PatchResult = { ok: false, stale: false, error: "Could not save." };
    await enqueueWrite(async () => {
      await performSaveRef.current();
      if (saveBlockedRef.current) {
        result = { ok: false, stale: true };
        return;
      }
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          expected_updated_at: loadedUpdatedAtRef.current,
          source: "editor",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "stale_page") {
        markConflict();
        result = { ok: false, stale: true };
        return;
      }
      if (!res.ok) {
        result = { ok: false, stale: false, error: data.error || "Could not save." };
        return;
      }
      const page = data as PageRow;
      rememberVersion(page);
      result = { ok: true, page };
    });
    return result;
  }

  async function reloadFromServer() {
    const pageId = selectedIdRef.current;
    if (pageId == null) return;
    pendingSave.current = null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await enqueueWrite(async () => {
      const res = await fetch(`/api/pages/${pageId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || "Could not reload this page.");
        return;
      }
      const updated = data as PageRow;
      setPages((ps) => ps.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setTitle(updated.title);
      titleRef.current = updated.title;
      setSlugInput(updated.slug);
      slugTouchedRef.current = false;
      loadedUpdatedAtRef.current = updated.updated_at;
      saveBlockedRef.current = false;
      setStale(false);
      setSaveError(null);
      setSaveState("saved");
      editorRef.current?.commands.setContent(editorContentFromPage(updated), { emitUpdate: false });
    });
  }

  /** Save any pending changes now (used before switching/deleting pages). */
  async function flushSave() {
    await saveNow();
  }

  /** Switch pages only after the current page's pending save has landed,
      so a late timer can never write one page's content into another. */
  async function selectPage(id: number | null) {
    await flushSave();
    setOpenMenuId(null);
    setTreeOpen(false);
    setSelectedId(id);
  }

  // Don't lose the last <900ms of typing when leaving the editor.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void saveNowRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the collection action menu on outside click / Escape.
  useEffect(() => {
    if (openMenuId == null) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!showFontColor && !listMenu && !showLineSpacing) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (showFontColor && fontColorRef.current && !fontColorRef.current.contains(target)) setShowFontColor(false);
      if (listMenu === "bullet" && bulletMenuRef.current && !bulletMenuRef.current.contains(target)) setListMenu(null);
      if (listMenu === "ordered" && orderedMenuRef.current && !orderedMenuRef.current.contains(target)) setListMenu(null);
      if (showLineSpacing && lineSpacingRef.current && !lineSpacingRef.current.contains(target)) setShowLineSpacing(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowFontColor(false);
        setListMenu(null);
        setShowLineSpacing(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showFontColor, listMenu, showLineSpacing]);

  /* ----- actions ----- */
  async function withWorking<T>(
    key: NonNullable<typeof working>,
    task: () => Promise<T>,
    quiet = false
  ): Promise<T | undefined> {
    if (!quiet && workingRef.current) return;
    if (!quiet) {
      workingRef.current = true;
      setWorking(key);
    }
    try {
      return await task();
    } finally {
      if (!quiet) {
        workingRef.current = false;
        setWorking(null);
      }
    }
  }

  async function createPage(collectionId: number, parentId: number | null, quiet = false) {
    await withWorking("page", async () => {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection_id: collectionId, parent_id: parentId, title: "Untitled" }),
      });
      if (!res.ok) return;
      const page = (await res.json()) as PageRow;
      setPages((ps) => [...ps, page]);
      await selectPage(page.id);
    }, quiet);
  }

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    setCollectionError(null);
    await withWorking("collection", async () => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newCollectionDescription.trim(), icon: newCollectionIcon }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCollectionError(data.error || "Could not create collection.");
        return;
      }
      const collection = (await res.json()) as CollectionRow;
      setCollections((cs) => [...cs, collection]);
      setNewCollectionName("");
      setNewCollectionDescription("");
      setNewCollectionIcon("book");
      setShowNewCollection(false);
      await createPage(collection.id, null, true);
    });
  }

  function startEditingCollection(c: CollectionRow) {
    setEditingCollectionId(c.id);
    setEditName(c.name);
    setEditDescription(c.description || "");
    setEditIcon(c.icon || "book");
    setCollectionError(null);
  }

  async function saveCollectionEdit(id: number) {
    const name = editName.trim();
    if (!name) {
      setCollectionError("Name is required.");
      return;
    }
    setCollectionError(null);
    await withWorking("collection-save", async () => {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: editDescription, icon: editIcon }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCollectionError(data.error || "Could not save collection.");
        return;
      }
      setCollections((cs) => cs.map((c) => (c.id === id ? { ...c, ...data } : c)));
      setEditingCollectionId(null);
    });
  }

  async function deleteCollection(c: CollectionRow) {
    const pageCount = pages.filter((p) => p.collection_id === c.id).length;
    if (
      !confirm(
        `Delete collection “${c.name}”${pageCount ? ` and its ${pageCount} page(s)` : ""}? This cannot be undone.`
      )
    )
      return;
    await withWorking("collection-delete", async () => {
      const res = await fetch(`/api/collections/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCollectionError(data.error || "Could not delete collection.");
        return;
      }
      // Abandon any pending page save — those pages are gone.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSave.current = null;
      setCollections((cs) => cs.filter((x) => x.id !== c.id));
      setPages((ps) => ps.filter((p) => p.collection_id !== c.id));
      if (selected && selected.collection_id === c.id) {
        const remaining = pages.filter((p) => p.collection_id !== c.id);
        setSelectedId(remaining[0]?.id ?? null);
      }
      if (editingCollectionId === c.id) setEditingCollectionId(null);
    });
  }

  async function togglePublish() {
    if (!selected) return;
    const status = selected.status === "published" ? "draft" : "published";
    const pageId = selected.id;
    await withWorking("publish", async () => {
      await patchPage(pageId, { status });
    });
  }

  async function deletePage() {
    if (!selected || !confirm(`Delete “${selected.title}” and all its sub-pages?`)) return;
    await withWorking("delete", async () => {
      await flushSave();
      await fetch(`/api/pages/${selected.id}`, { method: "DELETE" });
      const remaining = pages.filter((p) => p.id !== selected.id && p.parent_id !== selected.id);
      setPages(remaining);
      setSelectedId(remaining[0]?.id ?? null);
    });
  }

  async function movePage(parentId: number | null) {
    if (!selected) return;
    const pageId = selected.id;
    await withWorking("move", async () => {
      await patchPage(pageId, { parent_id: parentId });
    });
  }

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const prev = (editor.getAttributes("link").href as string) || "";
    const href = window.prompt("Link URL…", prev);
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: href.trim() }).run();
  }

  function insertImage() {
    if (!editor) return;
    const src = window.prompt(
      "Image URL… (direct picture link — Google Drive / Dropbox links are converted automatically)"
    );
    if (src === null || !src.trim()) return;
    const clean = src.trim();
    if (
      isSharePageUrl(clean) &&
      !confirm(
        "This looks like a share page, not a direct picture, so it may not display. Insert anyway? (Tip: attach share pages as a hyperlink instead.)"
      )
    )
      return;
    editor.chain().focus().setImage({ src: resolveImageUrl(clean) }).run();
  }

  async function saveSlug() {    if (!selected) return;
    const slug = slugInput.trim();
    if (!slug) {
      setSlugError("Slug can't be empty.");
      return;
    }
    setSlugError(null);
    const pageId = selected.id;
    await withWorking("slug", async () => {
      const result = await patchPage(pageId, { slug });
      if (!result.ok) {
        if (!result.stale) setSlugError(result.error);
        return;
      }
      setSlugInput(result.page.slug);
      slugTouchedRef.current = false;
    });
  }

  async function loadHistory() {
    if (!selected) return;
    await flushSave();
    setShowHistory(true);
    setHistoryLoading(true);
    setHistoryError(null);
    const response = await fetch(`/api/pages/${selected.id}/revisions`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setHistoryError(data.error || "Could not load revision history.");
    } else {
      setRevisions(data.revisions || []);
    }
    setHistoryLoading(false);
  }

  async function restoreRevision(revision: RevisionSummary) {
    if (!selected || !confirm(`Restore “${revision.title}” from ${formatRevisionDate(revision.created_at)}?`)) return;
    const pageId = selected.id;
    setHistoryError(null);
    await withWorking("restore", async () => {
      let failed = false;
      await enqueueWrite(async () => {
        await performSaveRef.current();
        if (saveBlockedRef.current) {
          failed = true;
          return;
        }
        const response = await fetch(`/api/pages/${pageId}/revisions/${revision.id}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expected_updated_at: loadedUpdatedAtRef.current }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 409 && data.code === "stale_page") {
          markConflict();
          failed = true;
          return;
        }
        if (!response.ok) {
          setHistoryError(data.error || "Could not restore this revision.");
          failed = true;
          return;
        }
        const updated = data.page as PageRow;
        setPages((current) => current.map((page) => page.id === updated.id ? { ...page, ...updated } : page));
        setTitle(updated.title);
        titleRef.current = updated.title;
        setSlugInput(updated.slug);
        slugTouchedRef.current = false;
        loadedUpdatedAtRef.current = updated.updated_at;
        editorRef.current?.commands.setContent(editorContentFromPage(updated), { emitUpdate: false });
        setSaveError(null);
        setSaveState("saved");
      });
      if (!failed) await loadHistory();
    });
  }

  function formatRevisionDate(value: string) {
    const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

  const hint = (label: string, combo?: string) => editorHint(label, combo, modKey);

  const toolbarBtn = (
    onClick: () => void,
    active: boolean,
    icon: React.ReactNode,
    label: string,
    shortcut?: string,
    disabled = false
  ) => {
    const title = hint(label, shortcut);
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={active ? "is-active" : ""}
        title={title}
        aria-label={title}
        disabled={disabled}
      >
        {icon}
      </button>
    );
  };

  const TABLE_SWATCHES: { id: string; label: string; color: string | null }[] = [
    { id: "none", label: "No color", color: null },
    { id: "moss", label: "Moss", color: "#D5DFCF" },
    { id: "brass", label: "Brass", color: "#F0E2C8" },
    { id: "brick", label: "Brick", color: "#F2D6D1" },
    { id: "warm", label: "Warm gray", color: "#E4DFD2" },
    { id: "cream", label: "Cream", color: "#F8F7F2" },
  ];

  function applyBg(color: string | null, scope: BackgroundScope) {
    if (!editor) return;
    applyTableBackground(editor, color, scope);
    editor.chain().focus().run();
    refreshTableUi();
  }

  function deleteTableSafe() {
    if (!editor) return;
    if (tableHasContent(editor) && !confirm("Delete this table and all of its contents?")) return;
    editor.chain().focus().deleteTable().run();
    refreshTableUi();
  }

  const FONT_SWATCHES: { id: string; label: string; color: string | null; ink?: string }[] = [
    { id: "default", label: "Default", color: null },
    { id: "moss", label: "Moss", color: "#4B5D45" },
    { id: "brass", label: "Brass", color: "#B8863B" },
    { id: "brick", label: "Brick", color: "#A6483A" },
    { id: "muted", label: "Muted", color: "#5C6156" },
    { id: "cream", label: "Cream", color: "#F8F7F2", ink: "#23281F" },
  ];

  function captureSpacingRange() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    spacingRangeRef.current = { from, to };
  }

  function applySpacing(patch: SpacingPatch, close = false) {
    if (!editor) return;
    const customFieldFocused = document.activeElement instanceof HTMLInputElement
      && lineSpacingRef.current?.contains(document.activeElement);
    setBlockSpacing(editor, patch, customFieldFocused ? spacingRangeRef.current ?? undefined : undefined);
    if (close) setShowLineSpacing(false);
  }

  function applyCustomSpacing() {
    const value = customSpacing.trim();
    if (!/^\d+(\.\d+)?$/.test(value)) return;
    applySpacing({ lineHeight: value }, true);
    setCustomSpacing(displayLineHeight(value));
  }

  function applyFontColor(color: string | null) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (!color) chain.unsetMark("textColor");
    else chain.setMark("textColor", { color });
    chain.run();
    setShowFontColor(false);
  }

  const treeNav = (
    <>
      {collectionError && (
        <div className="mb-2 border-l-2 px-2 py-1 text-[12px]" style={{ borderColor: "var(--brick)", color: "var(--brick)" }}>
          {collectionError}
        </div>
      )}
      {collections.map((c) => (
        <div key={c.id} style={{ marginBottom: 16 }}>
          {editingCollectionId === c.id ? (
            <div className="rounded border border-rule-strong bg-canvas p-2" style={{ margin: "0 2px" }}>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Name</label>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCollectionEdit(c.id);
                  if (e.key === "Escape") setEditingCollectionId(null);
                }}
                placeholder="Collection name…"
                className="w-full rounded border border-rule-strong bg-canvas px-2 py-1 text-[12.5px] outline-none focus:border-moss"
              />
              <label className="mb-1 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Description</label>
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCollectionEdit(c.id);
                  if (e.key === "Escape") setEditingCollectionId(null);
                }}
                placeholder="Short description…"
                className="w-full rounded border border-rule-strong bg-canvas px-2 py-1 text-[12.5px] outline-none focus:border-moss"
              />
              <label className="mb-1 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Icon <span className="font-normal normal-case">(Lucide)</span>
              </label>
              <IconPicker value={editIcon} onChange={setEditIcon} />
              <div className="mt-2 flex gap-1.5">
                <button className="btn btn-primary btn-sm" disabled={working === "collection-save"} onClick={() => saveCollectionEdit(c.id)}>
                  {working === "collection-save" ? "Saving…" : "Save"}
                </button>
                <button className="btn btn-sm" onClick={() => setEditingCollectionId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="sb-label">
                <Icon name={c.icon} size={12} /> {c.name}
                <span ref={openMenuId === c.id ? menuRef : undefined} style={{ marginLeft: "auto", position: "relative", display: "flex" }}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                    style={{ background: "none", border: 0, cursor: "pointer", color: "var(--ink-muted)", display: "grid", placeItems: "center", padding: 2 }}
                    title="Collection actions"
                    aria-label={`Actions for ${c.name}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === c.id}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {openMenuId === c.id && (
                    <span role="menu" aria-label={`Actions for ${c.name}`} className="coll-menu">
                      <button
                        role="menuitem"
                        className="coll-menu-item"
                        onClick={() => { setOpenMenuId(null); void createPage(c.id, null); }}
                      >
                        <Plus size={12} /> New page
                      </button>
                      {isSuperadmin && (
                        <>
                          <button
                            role="menuitem"
                            className="coll-menu-item"
                            onClick={() => { setOpenMenuId(null); startEditingCollection(c); }}
                          >
                            <Pencil size={12} /> Edit collection
                          </button>
                          <button
                            role="menuitem"
                            className="coll-menu-item danger"
                            onClick={() => { setOpenMenuId(null); deleteCollection(c); }}
                          >
                            <Trash2 size={12} /> Delete collection
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </span>
              </div>
              {c.description && (
                <div className="px-[10px] pb-1 text-[11.5px] leading-snug text-ink-muted">{c.description}</div>
              )}
            </>
          )}
          <nav className="tree">
            {(treeByCollection.get(c.id) || []).map(({ page, depth }) => (
              <button
                key={page.id}
                onClick={() => selectPage(page.id)}
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
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Name</label>
          <input
            autoFocus
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCollection()}
            placeholder="Collection name…"
            className="w-full rounded border border-rule-strong bg-canvas px-2 py-1 text-[12.5px] outline-none focus:border-moss"
          />
          <label className="mb-1 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Description</label>
          <input
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCollection()}
            placeholder="Short description…"
            className="w-full rounded border border-rule-strong bg-canvas px-2 py-1 text-[12.5px] outline-none focus:border-moss"
          />
          <label className="mb-1 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Icon <span className="font-normal normal-case">(Lucide)</span>
          </label>
          <IconPicker value={newCollectionIcon} onChange={setNewCollectionIcon} />
          <div className="mt-1.5 flex gap-1.5">
            <button className="btn btn-primary btn-sm" disabled={!!working} onClick={createCollection}>
              {working === "collection" ? "Creating…" : "Create"}
            </button>
            <button className="btn btn-sm" onClick={() => { setShowNewCollection(false); setCollectionError(null); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="sb-label w-full cursor-pointer hover:text-ink" onClick={() => setShowNewCollection(true)}>
          <Plus size={12} /> New collection
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="editor-topbar">
        <button
          type="button"
          className="btn btn-sm editor-tree-toggle"
          onClick={() => setTreeOpen((v) => !v)}
          aria-expanded={treeOpen}
          aria-controls="editor-tree-panel"
        >
          <Menu size={14} /> Pages
        </button>
        <div className={`save-state ${stale || saveError ? "error" : working || saveState !== "saved" ? "dirty" : ""}`} aria-live="polite">
          <Check size={13} />
          {working === "page"
            ? "Creating page…"
            : working === "collection"
              ? "Creating collection…"
              : working === "collection-save"
                ? "Saving collection…"
                : working === "collection-delete"
                  ? "Deleting collection…"
                  : working === "publish"
                    ? "Updating status…"
                    : working === "slug"
                      ? "Saving slug…"
                      : working === "delete"
                        ? "Deleting page…"
                        : working === "move"
                          ? "Moving page…"
                          : working === "restore"
                            ? "Restoring revision…"
                            : saveError
                              ? saveError
                              : saveState === "saved"
                                ? "Saved"
                                : saveState === "saving"
                                  ? "Saving…"
                                  : "Unsaved changes"}
          {stale && (
            <button type="button" className="btn btn-sm" onClick={() => void reloadFromServer()}>
              Reload
            </button>
          )}
        </div>
        <span className="editor-topbar-sep" style={{ color: "var(--rule)" }}>|</span>
        <button className="btn btn-ghost btn-sm" onClick={() => editor?.chain().focus().undo().run()} title={hint("Undo", "Z")} aria-label={hint("Undo", "Z")}>
          <Undo2 size={13} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => editor?.chain().focus().redo().run()} title={hint("Redo", "Shift+Z")} aria-label={hint("Redo", "Shift+Z")}>
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

      {treeOpen && (
        <>
          <div className="editor-tree-backdrop" onClick={() => setTreeOpen(false)} aria-hidden="true" />
          <aside id="editor-tree-panel" className="editor-tree-panel" aria-label="Pages">
            <div className="editor-tree-panel-head">
              <span>Pages</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTreeOpen(false)} aria-label="Close pages panel">
                <X size={14} />
              </button>
            </div>
            {treeNav}
          </aside>
        </>
      )}

      <div className="admin-layout">
        {/* left: tree navigator */}
        <aside className="wiki-sidebar">{treeNav}</aside>

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
                  titleRef.current = e.target.value;
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
                {toolbarBtn(() => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), <Bold size={14} />, "Bold", "B")}
                {toolbarBtn(() => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), <Italic size={14} />, "Italic", "I")}
                {toolbarBtn(() => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), <Strikethrough size={14} />, "Strikethrough", "Shift+S")}
                <div className="font-color-wrap" ref={fontColorRef}>
                  {toolbarBtn(
                    () => {
                      setListMenu(null);
                      setShowLineSpacing(false);
                      setShowFontColor((v) => !v);
                    },
                    editor.isActive("textColor") || showFontColor,
                    <span className="font-color-btn" style={{ ["--font-color" as string]: editor.isActive("textColor") ? (editor.getAttributes("textColor").color as string) || "#A6483A" : fontColor }}>
                      <Baseline size={14} />
                    </span>,
                    "Font color"
                  )}
                  {showFontColor && (
                    <div className="font-color-menu" role="listbox" aria-label="Font color">
                      {FONT_SWATCHES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="option"
                          title={s.label}
                          aria-label={s.label}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyFontColor(s.color)}
                          style={{
                            background: s.color ?? "transparent",
                            color: s.ink || (s.color ? "#fff" : "var(--ink-muted)"),
                          }}
                        >
                          A
                        </button>
                      ))}
                      <input
                        type="color"
                        className="table-color-input"
                        title="Custom font color"
                        aria-label="Custom font color"
                        value={fontColor}
                        onChange={(e) => {
                          setFontColor(e.target.value);
                          applyFontColor(e.target.value);
                        }}
                      />
                    </div>
                  )}
                </div>
                <span className="sep" />
                {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }), <Heading1 size={14} />, "Heading 1", "Alt+1")}
                {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), <Heading2 size={14} />, "Heading 2", "Alt+2")}
                {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), <Heading3 size={14} />, "Heading 3", "Alt+3")}
                <div className="line-spacing-wrap" ref={lineSpacingRef}>
                  {toolbarBtn(
                    () => {
                      setShowFontColor(false);
                      setListMenu(null);
                      setShowLineSpacing((open) => {
                        if (open) return false;
                        captureSpacingRange();
                        setCustomSpacing(blockSpacingAt(editor).lineHeight);
                        return true;
                      });
                    },
                    showLineSpacing,
                    <AlignVerticalSpaceAround size={14} />,
                    "Line & paragraph spacing"
                  )}
                  {showLineSpacing && (() => {
                    const spacing = blockSpacingAt(editor);
                    return (
                      <div className="line-spacing-menu" role="menu" aria-label="Line and paragraph spacing">
                        {LINE_SPACING_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={spacing.lineHeight === preset.id}
                            className={spacing.lineHeight === preset.id ? "is-active" : ""}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySpacing({ lineHeight: preset.id }, true)}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <label className="line-spacing-custom">
                          Custom
                          <input
                            type="number"
                            min={1}
                            max={3}
                            step={0.05}
                            aria-label="Custom line spacing"
                            value={customSpacing}
                            onChange={(e) => {
                              setCustomSpacing(e.target.value);
                              if (/^\d+(\.\d+)?$/.test(e.target.value.trim())) {
                                applySpacing({ lineHeight: e.target.value });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applyCustomSpacing();
                              }
                            }}
                            onBlur={applyCustomSpacing}
                          />
                        </label>
                        <div className="line-spacing-rule" />
                        <button
                          type="button"
                          role="menuitem"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySpacing({ spaceBefore: !spacing.spaceBefore })}
                        >
                          {spacing.spaceBefore ? "Remove space before paragraph" : "Add space before paragraph"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySpacing({ spaceAfter: !spacing.spaceAfter })}
                        >
                          {spacing.spaceAfter ? "Remove space after paragraph" : "Add space after paragraph"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <span className="sep" />
                <div className="list-style-wrap" ref={bulletMenuRef}>
                  {toolbarBtn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), <List size={14} />, "Bullet list", "Shift+8")}
                  <button
                    type="button"
                    className={`list-style-chevron ${listMenu === "bullet" ? "is-open" : ""}`}
                    aria-label="Bullet style"
                    aria-expanded={listMenu === "bullet"}
                    aria-haspopup="menu"
                    title="Bullet style"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowFontColor(false);
                      setShowLineSpacing(false);
                      setListMenu((cur) => (cur === "bullet" ? null : "bullet"));
                    }}
                  >
                    <ChevronDown size={12} />
                  </button>
                  {listMenu === "bullet" && (
                    <div className="list-style-menu" role="menu" aria-label="Bullet style">
                      {BULLET_STYLE_OPTIONS.map((style) => {
                        const current = (editor.getAttributes("bulletList").bulletStyle as string | null) || "disc";
                        return (
                          <button
                            key={style.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={editor.isActive("bulletList") && current === style.id}
                            className={editor.isActive("bulletList") && current === style.id ? "is-active" : ""}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              editor.chain().focus().setBulletListStyle(style.id === "disc" ? null : style.id).run();
                              setListMenu(null);
                            }}
                          >
                            <span className="list-style-sample" aria-hidden>{style.sample}</span>
                            {style.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="list-style-wrap" ref={orderedMenuRef}>
                  {toolbarBtn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), <ListOrdered size={14} />, "Numbered list", "Shift+7")}
                  <button
                    type="button"
                    className={`list-style-chevron ${listMenu === "ordered" ? "is-open" : ""}`}
                    aria-label="Numbering style"
                    aria-expanded={listMenu === "ordered"}
                    aria-haspopup="menu"
                    title="Numbering style"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowFontColor(false);
                      setShowLineSpacing(false);
                      setListMenu((cur) => (cur === "ordered" ? null : "ordered"));
                    }}
                  >
                    <ChevronDown size={12} />
                  </button>
                  {listMenu === "ordered" && (
                    <div className="list-style-menu" role="menu" aria-label="Numbering style">
                      {ORDERED_STYLE_OPTIONS.map((style) => {
                        const current = (editor.getAttributes("orderedList").type as string | null) || "1";
                        return (
                          <button
                            key={style.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={editor.isActive("orderedList") && current === style.id}
                            className={editor.isActive("orderedList") && current === style.id ? "is-active" : ""}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              editor.chain().focus().setOrderedListStyle(style.id === "1" ? null : style.id).run();
                              setListMenu(null);
                            }}
                          >
                            <span className="list-style-sample" aria-hidden>{style.sample}</span>
                            {style.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {toolbarBtn(() => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"), <ListChecks size={14} />, "To-do list", "Shift+9")}
                <span className="sep" />
                {toolbarBtn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), <TextQuote size={14} />, "Callout / quote", "Shift+B")}
                {toolbarBtn(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"), <CodeXml size={14} />, "Code block", "Alt+C")}
                {toolbarBtn(
                  () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
                  editor.isActive("table"),
                  <Table size={14} />,
                  "Insert table"
                )}
                {toolbarBtn(() => editor.chain().focus().setHorizontalRule().run(), false, <Minus size={14} />, "Divider")}
                <span className="sep" />
                {toolbarBtn(toggleLink, editor.isActive("link"), <Link2 size={14} />, "Link")}
                {toolbarBtn(insertImage, false, <ImagePlus size={14} />, "Image")}
              </div>

              {tableUi.active && (
                <div className="table-toolbar" role="toolbar" aria-label="Table tools">
                  {toolbarBtn(() => editor.chain().focus().addRowBefore().run(), false, <ArrowUpFromLine size={14} />, "Add row above")}
                  {toolbarBtn(() => editor.chain().focus().addRowAfter().run(), false, <ArrowDownFromLine size={14} />, "Add row below")}
                  {toolbarBtn(() => editor.chain().focus().addColumnBefore().run(), false, <ArrowLeftFromLine size={14} />, "Add column left")}
                  {toolbarBtn(() => editor.chain().focus().addColumnAfter().run(), false, <ArrowRightFromLine size={14} />, "Add column right")}
                  <span className="sep" />
                  {toolbarBtn(() => editor.chain().focus().deleteRow().run(), false, <ListMinus size={14} />, "Delete row", undefined, !tableUi.canDelRow)}
                  {toolbarBtn(
                    () => editor.chain().focus().deleteColumn().run(),
                    false,
                    <span className="table-icon-rotate" aria-hidden><ListMinus size={14} /></span>,
                    "Delete column",
                    undefined,
                    !tableUi.canDelCol
                  )}
                  {toolbarBtn(deleteTableSafe, false, <Trash2 size={14} />, "Delete table")}
                  <span className="sep" />
                  {toolbarBtn(
                    () => editor.chain().focus().mergeCells().run(),
                    false,
                    <TableCellsMerge size={14} />,
                    "Merge cells (Shift-click a rectangle first)",
                    undefined,
                    !tableUi.canMerge
                  )}
                  {toolbarBtn(
                    () => editor.chain().focus().splitCell().run(),
                    false,
                    <TableCellsSplit size={14} />,
                    "Split cell",
                    undefined,
                    !tableUi.canSplit
                  )}
                  <span className="sep" />
                  <span className="table-toolbar-label">
                    <PaintBucket size={12} /> Fill
                  </span>
                  <div className="table-scope-group" role="group" aria-label="Fill target">
                    {(["cell", "row", "column"] as BackgroundScope[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`table-scope-btn ${tableUi.scope === s ? "is-active" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setTableUi((u) => ({ ...u, scope: s }))}
                      >
                        {s === "cell" ? "Cell" : s === "row" ? "Row" : "Column"}
                      </button>
                    ))}
                  </div>
                  <div className="table-swatch-group" role="group" aria-label="Background colors">
                    {TABLE_SWATCHES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="table-swatch"
                        title={s.label}
                        aria-label={s.label}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyBg(s.color, tableUi.scope)}
                        style={{ background: s.color ?? "transparent" }}
                      >
                        {s.id === "none" ? <SquareDashed size={11} /> : null}
                      </button>
                    ))}
                    <input
                      type="color"
                      className="table-color-input"
                      title="Custom color"
                      aria-label="Custom color"
                      value={tableUi.customColor}
                      onChange={(e) => {
                        const color = e.target.value;
                        setTableUi((s) => ({ ...s, customColor: color }));
                        applyBg(color, tableUi.scope);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}

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
                    disabled={working === "publish"}
                    aria-busy={working === "publish"}
                    aria-label={working === "publish" ? "Updating publish status" : "Toggle publish"}
                  />
                </div>
              </div>
              <div className="field">
                <label>Parent page</label>
                <select
                  value={selected.parent_id ?? ""}
                  disabled={working === "move"}
                  aria-busy={working === "move"}
                  onChange={(e) => movePage(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(none — top level)</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>URL slug</label>
                <div className="flex gap-1.5">
                  <input
                    value={slugInput}
                    onChange={(e) => { setSlugInput(e.target.value); slugTouchedRef.current = true; }}
                    onKeyDown={(e) => e.key === "Enter" && saveSlug()}
                    spellCheck={false}
                    autoCapitalize="off"
                    placeholder="page-url-slug"
                    className="min-w-0 flex-1"
                  />
                  <button className="btn btn-sm shrink-0" disabled={working === "slug"} onClick={saveSlug}>
                    {working === "slug" ? "Saving…" : "Save"}
                  </button>
                </div>
                {slugError && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--brick)" }}>{slugError}</p>
                )}
                <p className="mt-1 text-[11.5px] leading-snug text-ink-muted">
                  Used in the page URL. Editing the title only updates it while it still matches the title.
                </p>
              </div>

              <h4>Visibility</h4>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {selected.status === "published"
                  ? "Anyone can read this page in the Catalogue."
                  : "Only admins can see this page. Publish to make it public."}
              </p>

              <h4>Revision history</h4>
              <button className="btn btn-sm" disabled={historyLoading} onClick={showHistory ? () => setShowHistory(false) : loadHistory}>
                <History size={13} /> {historyLoading ? "Loading history…" : showHistory ? "Hide history" : "View history"}
              </button>
              {showHistory && (
                <div className="revision-list" aria-live="polite">
                  {historyLoading && <p>Loading revisions…</p>}
                  {historyError && <p className="revision-error">{historyError}</p>}
                  {!historyLoading && !historyError && revisions.length === 0 && <p>No revisions yet.</p>}
                  {revisions.map((revision, index) => (
                    <div className="revision-item" key={revision.id}>
                      <div>
                        <b>{index === 0 ? "Current" : formatRevisionDate(revision.created_at)}</b>
                        <span>{revision.title} · {revision.status}</span>
                        <small>{revision.editor_name || "System"}{index === 0 ? ` · ${formatRevisionDate(revision.created_at)}` : ""}</small>
                      </div>
                      {index > 0 && (
                        <button className="btn btn-ghost btn-sm" disabled={working === "restore"} onClick={() => restoreRevision(revision)} title="Restore this revision">
                          <RotateCcw size={12} /> {working === "restore" ? "Restoring…" : "Restore"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <h4>Danger zone</h4>
              <button className="btn btn-danger btn-sm" disabled={working === "delete"} onClick={deletePage}>
                <Trash2 size={12} /> {working === "delete" ? "Deleting…" : "Delete page"}
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
