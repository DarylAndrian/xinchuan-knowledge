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
import type { Extensions } from "@tiptap/core";
import { isSafeBackgroundColor } from "./content";

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

const TableCellWithColor = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: backgroundColorAttribute(),
    };
  },
});

const TableHeaderWithColor = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: backgroundColorAttribute(),
    };
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
  Table.configure({ resizable: false }),
  TableRow,
  TableHeaderWithColor,
  TableCellWithColor,
  TaskList,
  TaskItem.configure({ nested: true }),
];
