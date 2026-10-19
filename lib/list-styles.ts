/** Marker choices for bullet and numbered lists. Defaults stay unset so older pages keep disc / 1. */

export const BULLET_STYLE_OPTIONS = [
  { id: "disc", label: "Disc", sample: "•" },
  { id: "circle", label: "Circle", sample: "○" },
  { id: "square", label: "Square", sample: "■" },
  { id: "dash", label: "Dash", sample: "–" },
  { id: "arrow", label: "Arrow", sample: "→" },
] as const;

export const ORDERED_STYLE_OPTIONS = [
  { id: "1", label: "Numbers", sample: "1." },
  { id: "a", label: "Lowercase letters", sample: "a." },
  { id: "A", label: "Uppercase letters", sample: "A." },
  { id: "i", label: "Lowercase Roman", sample: "i." },
  { id: "I", label: "Uppercase Roman", sample: "I." },
  { id: "01", label: "Leading zeros", sample: "01." },
] as const;

export type BulletStyleId = (typeof BULLET_STYLE_OPTIONS)[number]["id"];
export type OrderedStyleId = (typeof ORDERED_STYLE_OPTIONS)[number]["id"];

const BULLET_STYLES = new Set<string>(BULLET_STYLE_OPTIONS.map((s) => s.id).filter((id) => id !== "disc"));
const ORDERED_TYPES = new Set<string>(["a", "A", "i", "I", "01"]);

export function isStoredBulletStyle(value: string | null | undefined): value is Exclude<BulletStyleId, "disc"> {
  return !!value && BULLET_STYLES.has(value);
}

export function isStoredOrderedType(value: string | null | undefined): value is Exclude<OrderedStyleId, "1"> {
  return !!value && ORDERED_TYPES.has(value);
}

function cssListStyleToken(style: string): string | null {
  const match = style.match(/list-style-type\s*:\s*([^;]+)/i);
  if (!match) return null;
  return match[1].trim().toLowerCase().replace(/^["']|["']$/g, "").trim();
}

function orderedTypeFromCss(style: string): Exclude<OrderedStyleId, "1"> | null {
  const match = style.match(/list-style-type\s*:\s*([^;]+)/i);
  if (!match) return null;
  switch (match[1].trim().toLowerCase()) {
    case "upper-roman": return "I";
    case "lower-roman": return "i";
    case "upper-alpha":
    case "upper-latin": return "A";
    case "lower-alpha":
    case "lower-latin": return "a";
    case "decimal-leading-zero": return "01";
    default: return null;
  }
}

/** Read a non-default numbering style from saved HTML or pasted list markup. */
export function orderedTypeFromElement(element: HTMLElement): Exclude<OrderedStyleId, "1"> | null {
  if (element.getAttribute("data-list-style") === "decimal-leading-zero") return "01";
  const htmlType = element.getAttribute("type");
  if (isStoredOrderedType(htmlType)) return htmlType;
  const fromSelf = orderedTypeFromCss(element.getAttribute("style") || "");
  if (fromSelf) return fromSelf;
  const li = Array.from(element.children).find((child) => child.tagName === "LI");
  return li ? orderedTypeFromCss(li.getAttribute("style") || "") : null;
}

/** Read a non-default bullet marker from saved HTML or pasted list markup. */
export function bulletStyleFromElement(element: HTMLElement): Exclude<BulletStyleId, "disc"> | null {
  const data = element.getAttribute("data-list-style")?.trim().toLowerCase();
  if (isStoredBulletStyle(data)) return data;
  const fromSelf = bulletStyleFromCss(element.getAttribute("style") || "");
  if (fromSelf) return fromSelf;
  const li = Array.from(element.children).find((child) => child.tagName === "LI");
  return li ? bulletStyleFromCss(li.getAttribute("style") || "") : null;
}

function bulletStyleFromCss(style: string): Exclude<BulletStyleId, "disc"> | null {
  const token = cssListStyleToken(style);
  if (!token) return null;
  if (token === "circle" || token === "square") return token;
  if (token === "-" || token === "–" || token === "—" || token.startsWith("–") || token.startsWith("—")) return "dash";
  if (token === "→" || token.startsWith("→") || token === "disclosure-closed") return "arrow";
  return null;
}

/** Plain-text prefix copied with a bullet item. */
export function bulletPlainMarker(style: unknown): string {
  switch (style) {
    case "circle": return "◦ ";
    case "square": return "▪ ";
    case "dash": return "– ";
    case "arrow": return "→ ";
    default: return "- ";
  }
}

function toAlpha(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    x -= 1;
    s = String.fromCharCode(97 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s || "a";
}

function toRoman(n: number): string {
  const pairs: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
    [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
    [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let value = n;
  let out = "";
  for (const [amount, symbol] of pairs) {
    while (value >= amount) {
      out += symbol;
      value -= amount;
    }
  }
  return out || "i";
}

/** Plain-text prefix copied with a numbered item (`n` is the 1-based index). */
export function orderedPlainMarker(type: unknown, n: number): string {
  if (type === "a") return `${toAlpha(n)}. `;
  if (type === "A") return `${toAlpha(n).toUpperCase()}. `;
  if (type === "i") return `${toRoman(n)}. `;
  if (type === "I") return `${toRoman(n).toUpperCase()}. `;
  if (type === "01") return `${String(n).padStart(2, "0")}. `;
  return `${n}. `;
}
