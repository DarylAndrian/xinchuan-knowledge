import sanitizeHtml from "sanitize-html";

export function isSafeBackgroundColor(value: string): boolean {
  return /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)|[a-zA-Z]+)$/.test(
    value.trim()
  );
}

const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "strike",
  "blockquote", "pre", "code", "hr", "ul", "ol", "li", "a", "img", "table", "thead",
  "tbody", "tr", "th", "td", "span", "div", "label", "input",
];

const CELL_STYLE_KEYS = new Set(["background-color"]);

function sanitizeCellStyle(style: string | undefined): string | undefined {
  if (!style) return undefined;
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const [rawProp, ...rest] = declaration.split(":");
    if (!rawProp || rest.length === 0) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!CELL_STYLE_KEYS.has(prop)) continue;
    if (prop === "background-color" && !isSafeBackgroundColor(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept.length ? kept.join("; ") : undefined;
}

function sanitizeCellAttrs(attribs: Record<string, string>) {
  const next: Record<string, string> = { ...attribs };
  const bg = next["data-background-color"]?.trim();
  if (bg && isSafeBackgroundColor(bg)) {
    next.style = `background-color: ${bg}`;
  } else {
    const style = sanitizeCellStyle(next.style);
    if (style) next.style = style;
    else delete next.style;
    if (!isSafeBackgroundColor(bg ?? "")) delete next["data-background-color"];
  }
  return next;
}

/** Sanitize rich text at the trust boundary while preserving TipTap's document markup. */
export function sanitizeWikiHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      ul: ["data-type"],
      ol: ["start"],
      li: ["data-type", "data-checked"],
      input: ["type", "checked", "disabled"],
      th: ["colspan", "rowspan", "style", "data-background-color"],
      td: ["colspan", "rowspan", "style", "data-background-color"],
      code: ["class"],
      span: ["data-type"],
      div: ["data-type"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: { ...attribs, loading: attribs.loading || "lazy" },
      }),
      input: (_tagName, attribs) => ({
        tagName: "input",
        attribs: { ...attribs, disabled: "disabled" },
      }),
      th: (_tagName, attribs) => ({ tagName: "th", attribs: sanitizeCellAttrs(attribs) }),
      td: (_tagName, attribs) => ({ tagName: "td", attribs: sanitizeCellAttrs(attribs) }),
    },
    enforceHtmlBoundary: true,
  });
}

/** Convert saved rich text into normalized plain text for search and read-only APIs. */
export function htmlToText(html: string): string {
  return decodeHtmlEntities(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", "#39": "'", nbsp: " ",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39|nbsp);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named[lower] ?? entity;
  });
}
