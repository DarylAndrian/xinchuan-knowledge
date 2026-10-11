import type { Fragment, Node as ProseMirrorNode, Slice } from "@tiptap/pm/model";

/**
 * Plain-text clipboard serializer for the Tiptap editor.
 *
 * ProseMirror's default is `slice.content.textBetween(0, size, "\n\n")`, which
 * inserts a blank line between *every* block (list → listItem → paragraph all
 * count) and never emits list markers. Copying a bullet list therefore yields
 * text with huge gaps and no bullets/numbers.
 *
 * Here we walk the slice ourselves:
 *  - top-level blocks stay separated by a blank line (matches the old default),
 *  - list items are separated by a single newline and prefixed with a marker
 *    (`- ` bullets, `1. ` ordered, `[ ]`/`[x]` task lists),
 *  - nested lists are indented two spaces per level.
 */

const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);

function isList(node: ProseMirrorNode): boolean {
  return LIST_TYPES.has(node.type.name);
}

/** Text of an inline-bearing block, preserving hard breaks as newlines. */
function inlineText(node: ProseMirrorNode): string {
  return node.textBetween(0, node.content.size, "", (leaf) => {
    if (leaf.type.name === "hardBreak") return "\n";
    if (leaf.type.name === "image") return "";
    return leaf.text ?? "";
  });
}

function markerFor(listName: string, item: ProseMirrorNode, orderedIndex: number): string {
  if (listName === "orderedList") return `${orderedIndex}. `;
  if (listName === "taskList") return item.attrs?.checked ? "[x] " : "[ ] ";
  return "- ";
}

/** Serialize a single listItem / taskItem, including any nested lists. */
function serializeItem(item: ProseMirrorNode, depth: number, marker: string): string {
  const pad = "  ".repeat(depth);
  const continuation = pad + " ".repeat(marker.length);
  const lines: string[] = [];
  let placedMarker = false;

  item.content.forEach((child) => {
    if (isList(child)) {
      lines.push(serializeList(child, depth + 1));
      return;
    }
    const text = inlineText(child);
    if (!placedMarker) {
      lines.push(pad + marker + text);
      placedMarker = true;
    } else {
      // Extra paragraphs inside the same item align under the marker text.
      lines.push(...text.split("\n").map((l) => (l ? continuation + l : continuation)));
    }
  });

  if (!placedMarker && lines.length === 0) lines.push(pad + marker.trimEnd());
  return lines.join("\n");
}

function serializeList(list: ProseMirrorNode, depth: number): string {
  const name = list.type.name;
  const lines: string[] = [];
  let index = typeof list.attrs.start === "number" ? list.attrs.start : 1;

  list.content.forEach((item) => {
    const marker = markerFor(name, item, index);
    if (name === "orderedList") index++;
    lines.push(serializeItem(item, depth, marker));
  });

  return lines.join("\n");
}

/** Serialize any top-level block node to (possibly multi-line) plain text. */
function serializeBlock(node: ProseMirrorNode, depth: number): string {
  const pad = "  ".repeat(depth);

  if (isList(node)) return serializeList(node, depth);

  // A bare listItem can appear at the top of a slice when copying a partial
  // selection inside a list; give it a sensible default marker.
  if (node.type.name === "listItem") return serializeItem(node, depth, "- ");
  if (node.type.name === "taskItem") {
    return serializeItem(node, depth, node.attrs?.checked ? "[x] " : "[ ] ");
  }

  if (node.type.name === "blockquote") {
    const inner = serializeContent(node.content, depth);
    return inner.split("\n").map((l) => (l ? "> " + l : ">")).join("\n");
  }

  if (node.type.name === "codeBlock") {
    return node.textContent.split("\n").map((l) => pad + l).join("\n");
  }

  if (node.type.name === "horizontalRule") return pad + "---";

  return pad + inlineText(node);
}

/** Serialize a fragment: top-level blocks are separated by a blank line. */
function serializeContent(content: Fragment, depth: number): string {
  const blocks: string[] = [];
  content.forEach((node) => blocks.push(serializeBlock(node, depth)));
  return blocks.join("\n\n");
}

/** Tiptap/ProseMirror `clipboardTextSerializer` editor prop. */
export function clipboardTextSerializer(slice: Slice): string {
  return serializeContent(slice.content, 0);
}
