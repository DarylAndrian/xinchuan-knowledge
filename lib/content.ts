import sanitizeHtml from "sanitize-html";
import { normalizeLineHeight } from "./line-spacing";
import { isStoredBulletStyle, isStoredOrderedType } from "./list-styles";

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

const CELL_STYLE_KEYS = new Set(["background-color", "width", "height"]);
const SPAN_STYLE_KEYS = new Set(["color"]);
const ROW_STYLE_KEYS = new Set(["height"]);

function filterStyle(style: string | undefined, allowed: Set<string>): string | undefined {
  if (!style) return undefined;
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const [rawProp, ...rest] = declaration.split(":");
    if (!rawProp || rest.length === 0) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!allowed.has(prop)) continue;
    if ((prop === "background-color" || prop === "color") && !isSafeBackgroundColor(value)) continue;
    if ((prop === "width" || prop === "height") && !/^\d+(\.\d+)?(px|%)$/.test(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept.length ? kept.join("; ") : undefined;
}

function sanitizeSizeAttr(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  return /^\d+(\.\d+)?(px|%)$/.test(raw) || /^\d+(\.\d+)?$/.test(raw) ? raw : undefined;
}

function sanitizeCellAttrs(attribs: Record<string, string>) {
  const next: Record<string, string> = { ...attribs };
  const bg = next["data-background-color"]?.trim();
  const width = sanitizeSizeAttr(next.width);
  const height = sanitizeSizeAttr(next.height);
  const colwidth = next.colwidth?.trim();
  const safeColwidth = colwidth && /^\d+(,\d+)*$/.test(colwidth) ? colwidth : undefined;

  const styleObj: Record<string, string> = {};
  const filtered = filterStyle(next.style, CELL_STYLE_KEYS);
  if (filtered) {
    for (const declaration of filtered.split(";")) {
      const [prop, ...rest] = declaration.split(":");
      if (!prop || rest.length === 0) continue;
      styleObj[prop.trim().toLowerCase()] = rest.join(":").trim();
    }
  }

  const bgFinal =
    bg && isSafeBackgroundColor(bg)
      ? bg
      : styleObj["background-color"] && isSafeBackgroundColor(styleObj["background-color"])
        ? styleObj["background-color"]
        : null;
  const widthFinal = width || styleObj["width"];
  const heightFinal = height || styleObj["height"];

  const styleBits: string[] = [];
  if (bgFinal) styleBits.push(`background-color: ${bgFinal}`);
  if (widthFinal) {
    const v = widthFinal.endsWith("%") || widthFinal.endsWith("px") ? widthFinal : `${widthFinal}px`;
    styleBits.push(`width: ${v}`);
    next.width = v;
  } else {
    delete next.width;
  }
  if (heightFinal) {
    const v = heightFinal.endsWith("%") || heightFinal.endsWith("px") ? heightFinal : `${heightFinal}px`;
    styleBits.push(`height: ${v}`);
    next.height = v;
  } else {
    delete next.height;
  }

  if (styleBits.length) next.style = styleBits.join("; ");
  else delete next.style;

  if (bgFinal) next["data-background-color"] = bgFinal;
  else delete next["data-background-color"];

  if (safeColwidth) next.colwidth = safeColwidth;
  else delete next.colwidth;

  return next;
}

function sanitizeRowAttrs(attribs: Record<string, string>) {
  const next: Record<string, string> = { ...attribs };
  const height = sanitizeSizeAttr(next.height);
  const fromStyle = filterStyle(next.style, ROW_STYLE_KEYS);
  const styleHeight = fromStyle?.match(/height\s*:\s*([^;]+)/i)?.[1]?.trim();
  const finalHeight = height || (styleHeight && sanitizeSizeAttr(styleHeight));

  if (finalHeight) {
    const px = finalHeight.endsWith("%") || finalHeight.endsWith("px") ? finalHeight : `${finalHeight}px`;
    next.style = `height: ${px}`;
    next.height = px;
  } else {
    delete next.style;
    delete next.height;
  }
  return next;
}

function sanitizeUlAttrs(attribs: Record<string, string>) {
  const next: Record<string, string> = {};
  if (attribs["data-type"] === "taskList") next["data-type"] = "taskList";
  const style = attribs["data-list-style"]?.trim().toLowerCase();
  if (isStoredBulletStyle(style)) next["data-list-style"] = style;
  return next;
}

function sanitizeOlAttrs(attribs: Record<string, string>) {
  const next: Record<string, string> = {};
  const start = attribs.start?.trim();
  if (start && /^[1-9]\d*$/.test(start)) next.start = start;
  const type = attribs.type?.trim();
  if (type && isStoredOrderedType(type) && type !== "01") next.type = type;
  if (attribs["data-list-style"] === "decimal-leading-zero") next["data-list-style"] = "decimal-leading-zero";
  return next;
}

const BLOCK_SPACING_ATTRS = ["data-line-height", "data-space-before", "data-space-after", "style"];

function sanitizeBlockSpacing(attribs: Record<string, string>) {
  const next: Record<string, string> = {};
  const fromStyle = attribs.style?.match(/(?:^|;)\s*line-height\s*:\s*([^;]+)/i)?.[1];
  const lineHeight = normalizeLineHeight(attribs["data-line-height"] || fromStyle);
  if (lineHeight) {
    next["data-line-height"] = lineHeight;
    next.style = `line-height: ${lineHeight}`;
  }
  if (attribs["data-space-before"] === "1") next["data-space-before"] = "1";
  if (attribs["data-space-after"] === "1") next["data-space-after"] = "1";
  return next;
}

function sanitizeSpanAttrs(attribs: Record<string, string>) {
  const next: Record<string, string> = { ...attribs };
  const color = next["data-text-color"]?.trim();
  if (color && isSafeBackgroundColor(color)) {
    next.style = `color: ${color}`;
    next["data-text-color"] = color;
  } else {
    const style = filterStyle(next.style, SPAN_STYLE_KEYS);
    if (style) {
      next.style = style;
      const match = style.match(/color\s*:\s*([^;]+)/i);
      const fromStyle = match?.[1]?.trim();
      if (fromStyle && isSafeBackgroundColor(fromStyle)) next["data-text-color"] = fromStyle;
      else delete next["data-text-color"];
    } else {
      delete next.style;
      delete next["data-text-color"];
    }
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
      ul: ["data-type", "data-list-style"],
      ol: ["start", "type", "data-list-style"],
      li: ["data-type", "data-checked"],
      input: ["type", "checked", "disabled"],
      th: ["colspan", "rowspan", "colwidth", "width", "height", "style", "data-background-color"],
      td: ["colspan", "rowspan", "colwidth", "width", "height", "style", "data-background-color"],
      tr: ["height", "style"],
      code: ["class"],
      p: BLOCK_SPACING_ATTRS,
      h1: BLOCK_SPACING_ATTRS,
      h2: BLOCK_SPACING_ATTRS,
      h3: BLOCK_SPACING_ATTRS,
      span: ["data-type", "data-text-color", "style"],
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
      tr: (_tagName, attribs) => ({ tagName: "tr", attribs: sanitizeRowAttrs(attribs) }),
      ul: (_tagName, attribs) => ({ tagName: "ul", attribs: sanitizeUlAttrs(attribs) }),
      ol: (_tagName, attribs) => ({ tagName: "ol", attribs: sanitizeOlAttrs(attribs) }),
      p: (_tagName, attribs) => ({ tagName: "p", attribs: sanitizeBlockSpacing(attribs) }),
      h1: (_tagName, attribs) => ({ tagName: "h1", attribs: sanitizeBlockSpacing(attribs) }),
      h2: (_tagName, attribs) => ({ tagName: "h2", attribs: sanitizeBlockSpacing(attribs) }),
      h3: (_tagName, attribs) => ({ tagName: "h3", attribs: sanitizeBlockSpacing(attribs) }),
      span: (_tagName, attribs) => ({ tagName: "span", attribs: sanitizeSpanAttrs(attribs) }),
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
