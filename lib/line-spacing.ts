import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** Google Docs presets. 1.15 is the default and is stored as "no override". */
export const LINE_SPACING_PRESETS = [
  { id: "1", label: "Single" },
  { id: "1.15", label: "1.15" },
  { id: "1.5", label: "1.5" },
  { id: "2", label: "Double" },
] as const;

export const DEFAULT_LINE_HEIGHT = "1.15";
const MIN_LINE_HEIGHT = 1;
const MAX_LINE_HEIGHT = 3;
const BLOCKS = ["paragraph", "heading"];

export type SpacingPatch = {
  lineHeight?: string | null;
  spaceBefore?: boolean;
  spaceAfter?: boolean;
};

/** Unitless line spacing from 1 (single) through 3 (tighter than this overlaps the glyphs). */
export function normalizeLineHeight(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, Math.round(n * 100) / 100));
  const text = clamped.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return text === DEFAULT_LINE_HEIGHT ? null : text;
}

export function displayLineHeight(value: unknown): string {
  return normalizeLineHeight(value) ?? DEFAULT_LINE_HEIGHT;
}

function spaceFlag(value: unknown): "1" | null {
  return value === "1" || value === 1 || value === true ? "1" : null;
}

/** Paragraph and heading spacing, stored so it survives save and the published page. */
export const LineSpacing = Extension.create({
  name: "lineSpacing",

  addGlobalAttributes() {
    return [
      {
        types: BLOCKS,
        attributes: {
          lineHeight: {
            default: null as string | null,
            parseHTML: (element: HTMLElement) =>
              normalizeLineHeight(element.getAttribute("data-line-height") || element.style.lineHeight),
            renderHTML: (attributes: Record<string, unknown>) => {
              const value = normalizeLineHeight(attributes.lineHeight);
              if (!value) return {};
              return { "data-line-height": value, style: `line-height: ${value}` };
            },
          },
          spaceBefore: {
            default: null as string | null,
            parseHTML: (element: HTMLElement) => (element.getAttribute("data-space-before") === "1" ? "1" : null),
            renderHTML: (attributes: Record<string, unknown>) =>
              spaceFlag(attributes.spaceBefore) ? { "data-space-before": "1" } : {},
          },
          spaceAfter: {
            default: null as string | null,
            parseHTML: (element: HTMLElement) => (element.getAttribute("data-space-after") === "1" ? "1" : null),
            renderHTML: (attributes: Record<string, unknown>) =>
              spaceFlag(attributes.spaceAfter) ? { "data-space-after": "1" } : {},
          },
        },
      },
    ];
  },
});

export function blockSpacingAt(editor: Editor): { lineHeight: string; spaceBefore: boolean; spaceAfter: boolean } {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      return {
        lineHeight: displayLineHeight(node.attrs.lineHeight),
        spaceBefore: node.attrs.spaceBefore === "1",
        spaceAfter: node.attrs.spaceAfter === "1",
      };
    }
  }
  return { lineHeight: DEFAULT_LINE_HEIGHT, spaceBefore: false, spaceAfter: false };
}

function isSpacingBlock(node: ProseMirrorNode) {
  return node.type.name === "paragraph" || node.type.name === "heading";
}

/** Paragraphs and headings covered by the range, including the block that contains a caret. */
function spacingBlocks(doc: ProseMirrorNode, from: number, to: number) {
  const found = new Map<number, ProseMirrorNode>();
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(doc.content.size, Math.max(from, to));
  doc.nodesBetween(start, end, (node, pos) => {
    if (isSpacingBlock(node)) found.set(pos, node);
  });
  for (const pos of [start, end]) {
    const safe = Math.max(1, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(safe);
    for (let depth = $pos.depth; depth > 0; depth--) {
      const node = $pos.node(depth);
      if (!isSpacingBlock(node)) continue;
      found.set($pos.before(depth), node);
      break;
    }
  }
  return found;
}

/** Apply spacing to every paragraph and heading touched by the selection. */
export function setBlockSpacing(editor: Editor, patch: SpacingPatch, range?: { from: number; to: number }) {
  const from = range?.from ?? editor.state.selection.from;
  const to = range?.to ?? editor.state.selection.to;
  let tr = editor.state.tr;
  let changed = false;
  for (const [pos, node] of spacingBlocks(editor.state.doc, from, to)) {
    const attrs = { ...node.attrs };
    if (patch.lineHeight !== undefined) attrs.lineHeight = normalizeLineHeight(patch.lineHeight);
    if (patch.spaceBefore !== undefined) attrs.spaceBefore = patch.spaceBefore ? "1" : null;
    if (patch.spaceAfter !== undefined) attrs.spaceAfter = patch.spaceAfter ? "1" : null;
    if (
      attrs.lineHeight === node.attrs.lineHeight &&
      attrs.spaceBefore === node.attrs.spaceBefore &&
      attrs.spaceAfter === node.attrs.spaceAfter
    ) continue;
    tr = tr.setNodeMarkup(pos, undefined, attrs);
    changed = true;
  }
  if (changed) editor.view.dispatch(tr);
}
