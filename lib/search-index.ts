import { htmlToText } from "./content";
import { extractTocFromHtml } from "./headings";

export interface SearchChunk {
  heading: string;
  anchor: string;
  text: string;
}

const CHUNK_MIN = 800;
const CHUNK_MAX = 1200;

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "nor", "so", "yet",
  "of", "to", "in", "on", "at", "by", "for", "from", "with", "as", "into", "over",
  "after", "before", "about", "than", "then", "between", "through",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "it", "this", "that", "these", "those",
  "can", "could", "may", "might", "must", "shall", "should", "will", "would",
  "do", "does", "did", "doing",
  "what", "when", "where", "who", "whom", "which", "how", "why",
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "they", "them", "their",
  "not", "no", "yes", "there", "here", "just",
]);

/** Words that should influence a match. Stop words are dropped unless that removes the whole query. */
export function contentTerms(query: string): string[] {
  const raw = query.match(/[\p{L}\p{N}_-]+/gu)?.slice(0, 16) ?? [];
  const significant = raw.filter((term) => term.length > 1 && !STOP_WORDS.has(term.toLowerCase()));
  const chosen = (significant.length > 0 ? significant : raw.filter((term) => term.length > 1));
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of chosen) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  return terms;
}

/** OR prefix query so a page can match some of the words, not only all of them. */
export function ftsMatchQuery(query: string): string {
  return contentTerms(query)
    .map((term) => term.replace(/["*()]/g, ""))
    .filter((term) => term.length > 0)
    .map((term) => `"${term}"*`)
    .join(" OR ");
}

export function clampSearchLimit(limit: number | null | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return 5;
  return Math.min(20, Math.max(1, Math.floor(limit)));
}

function splitHeadingless(text: string): string[] {
  if (text.length <= CHUNK_MAX) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > CHUNK_MAX) {
    let cut = rest.lastIndexOf("\n", CHUNK_MAX);
    if (cut < CHUNK_MIN) cut = rest.lastIndexOf(" ", CHUNK_MAX);
    if (cut < CHUNK_MIN) cut = CHUNK_MAX;
    const piece = rest.slice(0, cut).trim();
    if (piece) parts.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** One chunk per H1–H3 section. Headingless text longer than 1,200 characters is split. */
export function buildSearchChunks(html: string): SearchChunk[] {
  const toc = extractTocFromHtml(html);
  const matches = [...html.matchAll(/<h([1-3])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi)];
  const ranges: Array<{ heading: string; anchor: string; html: string }> = [];
  if (matches.length === 0) {
    ranges.push({ heading: "", anchor: "", html });
  } else {
    ranges.push({ heading: "", anchor: "", html: html.slice(0, matches[0].index ?? 0) });
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? html.length) : html.length;
      ranges.push({
        heading: toc[i]?.text || "",
        anchor: toc[i]?.id || "",
        html: html.slice(start, end),
      });
    }
  }

  const chunks: SearchChunk[] = [];
  for (const range of ranges) {
    const text = htmlToText(range.html);
    if (!text) continue;
    if (range.anchor) {
      chunks.push({ heading: range.heading, anchor: range.anchor, text });
      continue;
    }
    const pieces = splitHeadingless(text);
    pieces.forEach((piece, index) => {
      chunks.push({
        heading: range.heading,
        anchor: index === 0 ? "intro" : `intro-${index + 1}`,
        text: piece,
      });
    });
  }
  return chunks;
}

export function chunksForPage(html: string): SearchChunk[] {
  const chunks = buildSearchChunks(html);
  if (chunks.length > 0) return chunks;
  return [{ heading: "", anchor: "intro", text: "" }];
}

export function termHits(text: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

export function termCoverage(text: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  return termHits(text, terms) / terms.length;
}

/**
 * Drop a hit that only shares a common word with the question.
 * It must match at least half of the meaningful terms (rounded up) and score
 * at least 60. One shared word scores about 26–51; real matches score about 80–106.
 */
export const MIN_SEARCH_SCORE = 60;

export function keepSearchHit(matched: number, termCount: number, score: number): boolean {
  if (termCount <= 0) return false;
  const needed = Math.ceil(termCount / 2);
  return matched >= needed && score >= MIN_SEARCH_SCORE;
}

/** Snippet from the matching section, wide enough to keep a nearby amount or sentence. */
export function snippetAround(text: string, query: string, width = 320): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= width) return normalized;
  const terms = contentTerms(query);
  const lower = normalized.toLowerCase();
  let idx = -1;
  const phrase = terms.join(" ").toLowerCase();
  if (phrase) {
    const at = lower.indexOf(phrase);
    if (at >= 0) idx = at;
  }
  if (idx < 0) {
    for (const term of terms) {
      const at = lower.indexOf(term.toLowerCase());
      if (at >= 0 && (idx < 0 || at < idx)) idx = at;
    }
  }
  if (idx < 0) return normalized.slice(0, width).trim() + "…";
  const start = Math.max(0, idx - Math.floor(width * 0.3));
  const slice = normalized.slice(start, start + width).trim();
  return (start > 0 ? "…" : "") + slice + (start + width < normalized.length ? "…" : "");
}
