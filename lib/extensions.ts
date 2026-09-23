import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Mark, mergeAttributes, type Extensions } from "@tiptap/core";
import { isSafeBackgroundColor } from "./content";
import { TableRowResize } from "./table-row-resize";

/** Prefer `colwidth`, fall back to a single `width` attribute. */
function parseColwidth(element: HTMLElement): number[] | null {
  const colwidth = element.getAttribute("colwidth");
  if (colwidth) {
    const widths = colwidth
      .split(",")
      .map((w) => Number.parseInt(w.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return widths.length ? widths : null;
  }
  const width = element.getAttribute("width");
  if (width) {
    const n = Number.parseInt(width.trim(), 10);
    return Number.isFinite(n) && n > 0 ? [n] : null;
  }
  return null;
}

/** Parse a safe CSS color from inline style or data attribute. */
function parseBackgroundColor(element: HTMLElement): string | null {
  const fromData = element.getAttribute("data-background-color")?.trim();
  if (fromData && isSafeBackgroundColor(fromData)) return fromData;
  const style = element.getAttribute("style") || "";
  const match = style.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
  const value = match?.[1]?.trim();
  return value && isSafeBackgroundColor(value) ? value : null;
}

function backgroundColorAttribute() {
  return {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => parseBackgroundColor(element),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes.backgroundColor;
      if (typeof value !== "string" || !value || !isSafeBackgroundColor(value)) return {};
      return {
        "data-background-color": value,
        style: `background-color: ${value}`,
      };
    },
  };
}

function parsePixelHeight(element: HTMLElement): number | null {
  const fromAttr = element.getAttribute("height");
  const fromStyle = element.style.height;
  const raw = (fromAttr || fromStyle || "").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 28 ? n : null;
}

function rowHeightAttribute() {
  return {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => parsePixelHeight(element),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes.height;
      const n = typeof value === "number" && Number.isFinite(value) && value >= 28 ? Math.round(value) : null;
      if (n == null) return {};
      return {
        height: String(n),
        style: `height: ${n}px`,
      };
    },
  };
}

function colwidthAttribute() {
  return {
    default: null as number[] | null,
    parseHTML: parseColwidth,
    renderHTML: (attributes: Record<string, unknown>) => {
      const raw = attributes.colwidth;
      const list = Array.isArray(raw)
        ? raw.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
        : [];
      if (!list.length) return {};
      const widths = list.map((n) => Math.round(n));
      return {
        colwidth: widths.join(","),
        // Published HTML has no <colgroup>; emit a cell width so the reader matches the editor.
        style: `width: ${widths[0]}px`,
      };
    },
  };
}

const TableCellWithColor = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute(),
      backgroundColor: backgroundColorAttribute(),
    };
  },
});

const TableHeaderWithColor = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute(),
      backgroundColor: backgroundColorAttribute(),
    };
  },
});

const TableRowWithHeight = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: rowHeightAttribute(),
    };
  },
});

/** Inline font color mark — span[data-text-color] with a safe color style. */
export const TextColor = Mark.create({
  name: "textColor",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const fromData = element.getAttribute("data-text-color")?.trim();
          if (fromData && isSafeBackgroundColor(fromData)) return fromData;
          const style = element.getAttribute("style") || "";
          const match = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
          const value = match?.[1]?.trim();
          return value && isSafeBackgroundColor(value) ? value : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const value = attributes.color;
          if (typeof value !== "string" || !value || !isSafeBackgroundColor(value)) return {};
          return {
            "data-text-color": value,
            style: `color: ${value}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-text-color]",
        getAttrs: (el) => {
          const value = (el as HTMLElement).getAttribute("data-text-color");
          return value && isSafeBackgroundColor(value) ? { color: value } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-text-color": HTMLAttributes.color || "" }), 0];
  },
});

export const editorExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Placeholder.configure({ placeholder: "Start writing, or insert blocks from the toolbar…" }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: "https",
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
  }),
  Image.configure({ inline: false, allowBase64: false }),
  TextColor,
  Table.configure({
    resizable: true,
    handleWidth: 6,
    cellMinWidth: 48,
    lastColumnResizable: true,
  }),
  TableRowWithHeight,
  TableHeaderWithColor,
  TableCellWithColor,
  TableRowResize,
  TaskList,
  TaskItem.configure({ nested: true }),
];
