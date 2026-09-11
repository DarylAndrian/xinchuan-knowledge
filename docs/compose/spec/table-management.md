---
feature: table-management
status: delivered
updated: 2026-09-11
branch: main
commits: pending
---

# Table Management

## Report

**What was built** — The editor now exposes a contextual table toolbar whenever the cursor is inside a table. Authors can add rows/columns around the current cell, delete the current row or column (disabled when it would empty the table), and delete the whole table (confirm only if it has text). Fill controls target cell, row, or column and apply a paper-and-moss preset or a custom hex color. `TableCell`/`TableHeader` persist `backgroundColor` as `data-background-color` plus a sanitized inline `background-color`. The API sanitizer allowlists those cell styles and strips other inline CSS.

**Verification** — `npx tsc --noEmit` PASS; `npm run build` PASS. Full browser matrix intentionally skipped per user request to keep verification light.

**Journey log**
- User chose main worktree (no isolated branch) and a compact scope toggle (Cell/Row/Column) instead of three parallel swatch rows.
- `isSafeBackgroundColor` lives in `lib/content.ts` so the sanitizer does not import TipTap extensions.
- TableMap positions are content-relative; absolute cells use `table.pos + 1 + map.map[i]`.

## [S1] Problem

The TipTap editor can insert a static 3×3 table, but once a table exists the author has no way to:

- insert or delete rows and columns,
- remove the whole table,
- apply background color to a cell, row, or column.

Structure edits and coloring must survive autosave, sanitization on the API boundary, and rendering in the published Catalogue reader.

## [S2] Design

### Scope of user-visible behavior

1. **Structure**
   - Add row above / below the cursor cell.
   - Add column left / right of the cursor cell.
   - Delete current row.
   - Delete current column.
   - Delete the entire table (confirm only if the table has text content).
2. **Coloring**
   - Scope toggle: cell / row / column.
   - Preset swatches (none, moss, brass, brick, warm gray, cream) plus `<input type="color">`.
   - Multi-cell selection paints every selected cell via the same attribute.
3. **Placement**
   - Sticky `.table-toolbar` under the main editor toolbar when `editor.isActive("table")`.

### Contracts

**TipTap extensions** (`lib/extensions.ts`)

- `TableCell` / `TableHeader` extended with `backgroundColor` (`data-background-color` + safe inline style).
- Built-in commands used for structure: `addRowBefore/After`, `addColumnBefore/After`, `deleteRow`, `deleteColumn`, `deleteTable`.
- `lib/table-utils.ts` applies fills via `setNodeMarkup` over TableMap-derived cell positions.

**Sanitization** (`lib/content.ts`)

- Allow `data-background-color` and `style` on `th`/`td`.
- Keep only `background-color: <safe value>` in style; strip everything else.

**Editor UI** (`components/EditorShell.tsx` + `app/globals.css`)

- Contextual table toolbar with structure + fill controls, design-system tokens, Lucide icons.

**Changelog**

- Entry under `## [Unreleased]`. Release 1.5.2 only when the user asks to cut it.

### Color model

| Token | Hex | Use |
| --- | --- | --- |
| none | (clear) | default |
| moss | `#D5DFCF` | soft green band |
| brass | `#F0E2C8` | attention band |
| brick | `#F2D6D1` | warning band |
| warm gray | `#E4DFD2` | neutral band |
| cream | `#F8F7F2` | light band |
| custom | user hex | advanced |

### Error / edge behavior

- Toolbar hidden outside tables.
- Delete row/column disabled when only one remains.
- Delete table confirms when the table has text.
- Existing content without fills remains valid.

## [S3] Out of Scope

- Merge / split cells, column resize, header-row toggles beyond insert.
- Text color, borders, cell padding.
- Table captions or nested tables.
- Version release bump unless requested.

## Tasks

- [x] T1: Extend TableCell/TableHeader with `backgroundColor` attribute and wire allowed tags/attributes in `lib/content.ts` — acceptance: sanitized HTML round-trips `data-background-color`/`background-color` on `th`/`td` and strips other styles. (covers: S2)
- [x] T2: Implement table structure commands in a contextual menu (add/delete row/column, delete table) — acceptance: with cursor in a table, each action mutates the table correctly; menu hidden outside tables. (covers: S2)
- [x] T3: Implement cell/row/column background coloring (presets + custom hex + clear) — acceptance: apply/clear works for cursor cell, full row, full column, and multi-cell selection; colors render in editor and published view. (covers: S2)
- [x] T4: Style the contextual menu and colored-cell CSS in light/dark themes — acceptance: menu matches design system; colors remain readable in both themes. (covers: S2)
- [x] T5: Changelog entry + light verification (typecheck + production build) — acceptance: `tsc --noEmit` and `npm run build` pass. (covers: S2)
