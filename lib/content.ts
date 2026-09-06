import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "strike",
  "blockquote", "pre", "code", "hr", "ul", "ol", "li", "a", "img", "table", "thead",
  "tbody", "tr", "th", "td", "span", "div", "label", "input",
];

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
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
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
