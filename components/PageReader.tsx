"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import type { CommentWithAuthor } from "@/lib/comments";

interface Props {
  html: string;
  pageId: number;
  comments: CommentWithAuthor[];
  canComment: boolean;
  canModerate: boolean;
  currentUserId: number | null;
  children?: React.ReactNode;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function PageReader({
  html,
  pageId,
  comments: initialComments,
  canComment,
  canModerate,
  currentUserId,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState(initialComments);
  const [openId, setOpenId] = useState<number | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const pendingRange = useRef<Range | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const threads = useMemo(() => {
    const roots = comments.filter((c) => c.parent_id === null);
    return roots.map((root) => ({
      root,
      replies: comments.filter((c) => c.parent_id === root.id),
    }));
  }, [comments]);

  /* ----- render html, build TOC, wrap comment anchors ----- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = html;

    // build TOC
    const headings = Array.from(el.querySelectorAll("h1, h2, h3"));
    const items: TocItem[] = headings.map((h, i) => {
      const id = `h-${i}`;
      h.id = id;
      return { id, text: h.textContent || "", level: Number(h.tagName[1]) };
    });
    setToc(items);

    // wrap comment anchors
    let idx = 0;
    for (const c of comments) {
      if (c.parent_id !== null || !c.quote) continue;
      idx += 1;
      wrapQuote(el, c.quote, c.id, idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, pageId]);

  function wrapQuote(container: HTMLElement, quote: string, cid: number, idx: number): boolean {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const parent = node.parentElement;
      if (parent && !parent.closest(".c-anch")) {
        const at = node.textContent?.indexOf(quote) ?? -1;
        if (at >= 0) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + quote.length);
          const span = document.createElement("span");
          span.className = "c-anch";
          span.dataset.cid = String(cid);
          try {
            range.surroundContents(span);
            const tag = document.createElement("span");
            tag.className = "c-anchor-idx";
            tag.textContent = String(idx);
            span.appendChild(tag);
            span.addEventListener("click", () => setOpenId(cid));
            return true;
          } catch {
            return false;
          }
        }
      }
      node = walker.nextNode() as Text | null;
    }
    return false;
  }

  /* ----- mark open anchor ----- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.querySelectorAll(".c-anch").forEach((a) => {
      a.classList.toggle("open", (a as HTMLElement).dataset.cid === String(openId));
    });
  }, [openId]);

  /* ----- text selection → comment toolbar ----- */
  useEffect(() => {
    function onUp(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      const sel = window.getSelection();
      const container = containerRef.current;
      if (!canComment || !container || !sel || sel.isCollapsed || !sel.toString().trim()) {
        setToolbarPos(null);
        return;
      }
      const anchorEl =
        sel.anchorNode &&
        (sel.anchorNode.nodeType === 1
          ? (sel.anchorNode as Element)
          : sel.anchorNode.parentElement);
      if (!anchorEl || !container.contains(anchorEl)) {
        setToolbarPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      pendingRange.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
    }
    function onDown(e: MouseEvent) {
      if (!toolbarRef.current?.contains(e.target as Node)) setToolbarPos(null);
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, [canComment]);

  const openThread = threads.find((t) => t.root.id === openId) || null;

  /* ----- actions ----- */
  const commentOnSelection = useCallback(async () => {
    const range = pendingRange.current;
    setToolbarPos(null);
    if (!range) return;
    const quote = range.toString().trim();
    if (!quote) return;
    setBusy(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId, quote, body: "" }),
    });
    setBusy(false);
    if (!res.ok) return;
    const created: CommentWithAuthor = await res.json();
    // wrap immediately with a provisional index
    const el = containerRef.current;
    if (el) {
      try {
        const span = document.createElement("span");
        span.className = "c-anch open";
        span.dataset.cid = String(created.id);
        range.surroundContents(span);
        const tag = document.createElement("span");
        tag.className = "c-anchor-idx";
        tag.textContent = String(threads.length + 1);
        span.appendChild(tag);
        span.addEventListener("click", () => setOpenId(created.id));
      } catch {
        /* selection crossed nodes; thread still exists in rail */
      }
    }
    setComments((cs) => [...cs, created]);
    setOpenId(created.id);
  }, [pageId, threads.length]);

  async function submitReply() {
    if (!openThread || !reply.trim()) return;
    setBusy(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: pageId,
        quote: "",
        body: reply.trim(),
        parent_id: openThread.root.id,
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    const created: CommentWithAuthor = await res.json();
    setComments((cs) => [...cs, created]);
    setReply("");
  }

  async function submitThreadBody() {
    // first message of a brand-new thread created from a selection
    if (!openThread || openThread.root.body || !reply.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/comments/${openThread.root.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });
    setBusy(false);
    if (!res.ok) return;
    setComments((cs) =>
      cs.map((c) => (c.id === openThread.root.id ? { ...c, body: reply.trim() } : c))
    );
    setReply("");
  }

  async function deleteComment(id: number) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setComments((cs) => cs.map((c) => (c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c)));
  }

  const canDelete = (c: CommentWithAuthor) => canModerate || c.author_id === currentUserId;

  function fmtTime(iso: string) {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <>
      {/* article column — direct child of .wiki-layout grid */}
      <main className="wiki-main">
        <div className="article">
          {children}
          <div ref={containerRef} className="wiki-content" />
        </div>
      </main>

        {/* right rail */}
        <aside className="wiki-rail">
          {!openThread ? (
            <>
              <div className="rail-label">On this page</div>
              <nav className="toc">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className={t.level === 3 ? "pl-6" : ""}
                    style={t.level === 1 ? { fontWeight: 600 } : undefined}
                  >
                    {t.text}
                  </a>
                ))}
              </nav>
              <div className="rail-label" style={{ marginTop: 26 }}>
                Comments · {threads.filter((t) => !t.root.deleted_at).length}
              </div>
              <nav className="toc">
                {threads.map((t, i) => (
                  <button key={t.root.id} onClick={() => setOpenId(t.root.id)}>
                    {i + 1} · {t.root.quote ? truncate(t.root.quote, 26) : truncate(t.root.body, 26)}
                  </button>
                ))}
                {canComment && (
                  <div className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
                    Select any text in the article to start a comment anchored to it.
                  </div>
                )}
              </nav>
            </>
          ) : (
            <div className="thread-panel">
              <div className="thread-head">
                <div className="rail-label" style={{ margin: 0 }}>Comment thread</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)} aria-label="Close thread">
                  <X size={13} />
                </button>
              </div>
              {openThread.root.quote && (
                <div className="thread-quote">“{openThread.root.quote}”</div>
              )}
              {[openThread.root, ...openThread.replies].map((c) => (
                <div key={c.id} className={`t-comment${c.deleted_at ? " removed" : ""}`}>
                  <div className="head">
                    <b>{c.author_name}</b>
                    <span className="role">{c.author_role}</span>
                    <time>{fmtTime(c.created_at)}</time>
                  </div>
                  <div className="text">
                    {c.deleted_at
                      ? "[ This comment was removed by a moderator ]"
                      : c.body || "…"}
                  </div>
                  {!c.deleted_at && (
                    <div className="actions">
                      {canDelete(c) && (
                        <button className="del" onClick={() => deleteComment(c.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {canComment && (
                <div className="thread-box">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      openThread.root.body ? "Reply to this thread…" : "Add your comment on the selected text…"
                    }
                  />
                  <div className="mt-1.5 flex justify-end">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy || !reply.trim()}
                      onClick={openThread.root.body ? submitReply : submitThreadBody}
                    >
                      {openThread.root.body ? "Reply" : "Comment"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

      {/* floating selection toolbar */}
      {canComment && toolbarPos && (
        <div
          ref={toolbarRef}
          className="sel-toolbar show"
          style={{ left: toolbarPos.x - 55, top: toolbarPos.y - 44 }}
        >
          <button onClick={commentOnSelection}>
            <MessageSquarePlus size={13} /> Comment
          </button>
        </div>
      )}
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
