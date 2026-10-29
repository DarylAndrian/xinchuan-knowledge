import { generateJSON } from "@tiptap/html/server";
import { editorExtensions } from "./extensions";

/** TipTap JSON that has no document type cannot be loaded by the editor. */
export function isBlankDocJson(value: string | null | undefined): boolean {
  const raw = (value ?? "").trim();
  if (!raw || raw === "{}" || raw === "null") return true;
  try {
    const parsed = JSON.parse(raw) as { type?: unknown };
    return !parsed || typeof parsed !== "object" || !parsed.type;
  } catch {
    return true;
  }
}

/**
 * A caller-supplied editor document. Blank "{}" is treated as missing so an
 * HTML-only write can rebuild the editor copy instead of wiping it.
 */
export function providedContentJson(value: unknown): string | null {
  if (typeof value !== "string" || isBlankDocJson(value)) return null;
  return value.trim();
}

/** Build the editor document from wiki HTML with the same extensions as the editor. */
export function contentJsonFromHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
  return JSON.stringify(generateJSON(trimmed, editorExtensions));
}
