import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";

export type BackgroundScope = "cell" | "row" | "column";

function isCellLike(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const typed = node as { type?: { name?: string; spec?: { tableRole?: string } } };
  const role = typed.type?.spec?.tableRole;
  if (role === "cell" || role === "header_cell") return true;
  const name = typed.type?.name;
  return name === "tableCell" || name === "tableHeader";
}

function findTable(state: Editor["state"]) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      return { node, pos: $from.before(depth), depth };
    }
  }
  return null;
}

function currentCellPos(state: Editor["state"]): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (isCellLike(node)) {
      return $from.before(depth);
    }
  }
  return null;
}

/** Collect absolute cell positions for the cursor cell / its row / its column. */
export function collectCellPositions(editor: Editor, scope: BackgroundScope): number[] {
  const { state } = editor;

  if (state.selection instanceof CellSelection) {
    const selected: number[] = [];
    for (const range of state.selection.ranges) {
      for (let d = range.$from.depth; d > 0; d--) {
        if (isCellLike(range.$from.node(d))) {
          selected.push(range.$from.before(d));
          break;
        }
      }
    }
    if (selected.length) return [...new Set(selected)];
  }

  const table = findTable(state);
  const cellPos = currentCellPos(state);
  if (!table || cellPos === null) return [];

  const map = TableMap.get(table.node);
  const rel = cellPos - table.pos - 1;
  let row: number;
  let col: number;
  try {
    const rect = map.findCell(rel);
    row = rect.top;
    col = rect.left;
  } catch {
    return [cellPos];
  }

  const tableStart = table.pos + 1;

  const positions: number[] = [];
  if (scope === "cell") {
    positions.push(tableStart + map.map[row * map.width + col]);
  } else if (scope === "row") {
    for (let c = 0; c < map.width; c++) {
      positions.push(tableStart + map.map[row * map.width + c]);
    }
  } else {
    for (let r = 0; r < map.height; r++) {
      positions.push(tableStart + map.map[r * map.width + col]);
    }
  }

  // De-dupe (merged cells map to the same start)
  return [...new Set(positions)];
}

export function applyTableBackground(
  editor: Editor,
  color: string | null,
  scope: BackgroundScope
): boolean {
  const positions = collectCellPositions(editor, scope);
  if (!positions.length) return false;

  return editor.commands.command(({ tr, state, dispatch }) => {
    if (!dispatch) return true;
    let mapped = false;
    for (const pos of positions) {
      const resolved = tr.doc.nodeAt(pos);
      if (!resolved || !isCellLike(resolved)) continue;
      const attrs = { ...resolved.attrs, backgroundColor: color };
      tr.setNodeMarkup(pos, undefined, attrs);
      mapped = true;
    }
    if (!mapped) return false;
    tr.setMeta("addToHistory", true);
    return true;
  });
}

export function canDeleteCurrentRow(editor: Editor): boolean {
  const table = findTable(editor.state);
  if (!table) return false;
  return TableMap.get(table.node).height > 1;
}

export function canDeleteCurrentColumn(editor: Editor): boolean {
  const table = findTable(editor.state);
  if (!table) return false;
  return TableMap.get(table.node).width > 1;
}

export function tableHasContent(editor: Editor): boolean {
  const table = findTable(editor.state);
  if (!table) return false;
  return table.node.textContent.trim().length > 0;
}
