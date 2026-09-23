import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { findTable } from "@tiptap/pm/tables";

const MIN_ROW_HEIGHT = 28;

function parseHeight(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function rowDomAt(view: EditorView, rowPos: number): HTMLTableRowElement | null {
  try {
    const dom = view.domAtPos(rowPos).node;
    const el = dom instanceof HTMLElement ? dom : dom.parentElement;
    return el?.closest("tr") ?? null;
  } catch {
    return null;
  }
}

function applyLiveHeight(view: EditorView, rowPos: number, height: number) {
  const row = rowDomAt(view, rowPos);
  if (row) row.style.height = `${height}px`;
}

function commitRowHeight(view: EditorView, rowPos: number, height: number) {
  const resolved = view.state.doc.resolve(rowPos);
  const row = resolved.nodeAfter;
  if (!row || row.type.name !== "tableRow") return;
  view.dispatch(view.state.tr.setNodeMarkup(rowPos, undefined, { ...row.attrs, height }));
}

function startRowDrag(
  view: EditorView,
  event: MouseEvent,
  rowPos: number,
  startHeight: number,
  handle: HTMLElement
) {
  event.preventDefault();
  event.stopPropagation();
  const startY = event.clientY;
  handle.classList.add("active");

  function onMove(e: MouseEvent) {
    const next = Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + (e.clientY - startY)));
    applyLiveHeight(view, rowPos, next);
  }

  function onUp(e: MouseEvent) {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    handle.classList.remove("active");
    const next = Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + (e.clientY - startY)));
    commitRowHeight(view, rowPos, next);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/** Drag handles along table row borders to set a fixed pixel row height. */
export const TableRowResize = Extension.create({
  name: "tableRowResize",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          decorations(state) {
            if (!editor.isEditable) return DecorationSet.empty;
            const found = findTable(state.selection.$from);
            if (!found) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            found.node.forEach((row, offset) => {
              const rowStart = found.pos + 1 + offset;
              const startHeight = parseHeight(row.attrs.height) ?? MIN_ROW_HEIGHT;

              const handle = document.createElement("div");
              handle.className = "row-resize-handle";
              handle.contentEditable = "false";
              handle.title = "Drag to resize row";
              handle.addEventListener("mousedown", (event: MouseEvent) => {
                if (typeof event.button === "number" && event.button !== 0) return;
                startRowDrag(editor.view, event, rowStart, startHeight, handle);
              });

              decorations.push(
                Decoration.widget(rowStart + row.nodeSize - 1, handle, {
                  side: 1,
                  ignoreSelection: true,
                })
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
