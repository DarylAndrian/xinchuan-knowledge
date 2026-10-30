import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { htmlToText } from "../lib/content.ts";
import { extractTocFromHtml } from "../lib/headings.ts";
import { buildSearchChunks, keepSearchHit, MIN_SEARCH_SCORE, NOISE_SCORE_FLOOR } from "../lib/search-index.ts";

const dataDir = mkdtempSync(path.join(tmpdir(), "xk-search-"));
process.env.XINCHUAN_DATA_DIR = dataDir;

const { db, syncPageSearch, ensureSearchIndex } = await import("../lib/db.ts");
const { searchPages } = await import("../lib/pages.ts");

after(() => {
  try { db.close(); } catch { /* already closed */ }
  rmSync(dataDir, { recursive: true, force: true });
});

function addCollection(name: string): number {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
  return Number(
    db.prepare("INSERT INTO collections (name, slug, description, icon, position) VALUES (?, ?, '', '', 0)")
      .run(name, slug).lastInsertRowid
  );
}

function addPage(collectionId: number, title: string, html: string, status = "published"): number {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"}-${collectionId}`;
  const id = Number(
    db.prepare(
      `INSERT INTO pages (collection_id, parent_id, title, slug, icon, content_json, content_html, status, position)
       VALUES (?, NULL, ?, ?, '', '{}', ?, ?, 0)`
    ).run(collectionId, title, slug, html, status).lastInsertRowid
  );
  syncPageSearch(id);
  return id;
}

const financeId = addCollection("Finance");
const taxiId = addCollection("HOKI Taxi");
const foodId = addCollection("HOKI Food");
const probeId = addCollection("Probe");

const paymentHtml = `
<h2>Convenience stores</h2>
<p>Customers can pay at a convenience store with a barcode.</p>
<table>
  <tr><td>001</td><td>ECPay</td><td>Xinchuan</td></tr>
  <tr><td>Xinchuan</td><td>HOKI</td><td>Go</td></tr>
</table>
`;

addPage(financeId, "Current Available Payment Options", paymentHtml);
addPage(financeId, "Cash desk", "<h2>Counter</h2><p>Customers pay cash at the counter.</p>");
addPage(
  foodId,
  "HOKI Food General Rule",
  `<p>Food orders follow these rules.</p>
   <h2>Delivery fee</h2>
   <p>The delivery fee is NT$45 per order inside the service area.</p>
   <h2>Hours</h2>
   <p>Orders are accepted from 10:00 to 21:00.</p>`
);
addPage(
  taxiId,
  "HOKI Taxi General Rule",
  `<h2>Cancellation</h2>
   <p>What happens if a passenger cancels a taxi reservation: the booking is released and no car is dispatched.</p>
   <h2>Flag fall</h2>
   <p>The flag-down fee is NT$85.</p>`
);
addPage(taxiId, "HOKI Taxi Airport", "<h2>Airport fee</h2><p>The airport fee is NT$100.</p>");
addPage(taxiId, "Dispatch notes", "<h2>Calls</h2><p>A passenger called the desk.</p>");
addPage(probeId, "Staff Handbook", "<p>employee annual leave policy</p>", "draft");
addPage(probeId, "Post-Release Feature Queue", "<h2>Privacy</h2><p>The privacy policy covers how account data is stored.</p>");

for (let i = 1; i <= 22; i++) {
  addPage(probeId, `Probe ${i}`, `<p>limitprobe ${i}</p>`);
}

addPage(
  probeId,
  "Many Sections",
  `<h2>One</h2><p>zebraquota alpha</p>
   <h2>Two</h2><p>zebraquota beta</p>
   <h2>Three</h2><p>zebraquota gamma</p>
   <h2>Four</h2><p>zebraquota delta</p>`
);

// Fixtures shaped like the live wiki: the page that answers the question does
// NOT restate it, so only two of the five query words appear ("taxi" and
// "reservation"; "cancelled" does not match the query word "cancels"). This is
// the case the old 60-point cutoff dropped while reporting the query empty.
const dispatchId = addCollection("Dispatch Rules");
addPage(
  dispatchId,
  "Ride Cancellation Rule",
  "<h2>Cancellation</h2><p>If a ride is cancelled the taxi reservation is released and no driver is dispatched.</p>"
);
addPage(dispatchId, "Driver Roster", "<h2>Roster</h2><p>Drivers sign up at the depot each morning.</p>");

function titles(query: string, options?: { collection?: string | number; limit?: number }) {
  return searchPages(query, options).map((hit) => hit.title);
}

describe("wiki search", { concurrency: false }, () => {
  test("plain text separates cells, rows, paragraphs, lists, and headings", () => {
    const table = htmlToText(
      "<table><tr><td>001</td><td>ECPay</td><td>Xinchuan</td></tr><tr><td>HOKI</td><td>Go</td></tr></table>"
    );
    assert.equal(/001ECPay|ECPayXinchuan|HOKIGo/.test(table), false);
    assert.match(table, /001/);
    assert.match(table, /ECPay/);
    assert.match(table, /HOKI/);
    assert.match(table, /\bGo\b/);

    const blocks = htmlToText("<h2>Title</h2><p>Alpha</p><p>Beta</p><ul><li><p>One</p></li><li><p>Two</p></li></ul>");
    assert.equal(/TitleAlpha|AlphaBeta|OneTwo/.test(blocks), false);
    assert.match(blocks, /Title/);
    assert.match(blocks, /Alpha/);
    assert.match(blocks, /One/);
    assert.match(blocks, /Two/);
  });

  test("heading sections keep the published anchor and long headingless text is split", () => {
    const html = "<p>Intro text</p><h2>Delivery fee</h2><p>NT$45</p><h3>Notes</h3><p>Later</p>";
    const chunks = buildSearchChunks(html);
    const toc = extractTocFromHtml(html);
    assert.equal(chunks[0].anchor, "intro");
    assert.equal(chunks[1].heading, "Delivery fee");
    assert.equal(chunks[1].anchor, toc[0].id);
    assert.equal(chunks[2].anchor, toc[1].id);

    const words = Array.from({ length: 400 }, () => "alpha").join(" ");
    const split = buildSearchChunks(`<p>${words}</p>`);
    assert.ok(split.length >= 2);
    split.forEach((chunk, index) => {
      assert.ok(chunk.text.length <= 1200);
      if (index < split.length - 1) assert.ok(chunk.text.length >= 800);
    });
    assert.equal(split[0].anchor, "intro");
    assert.equal(split[1].anchor, "intro-2");

    const headed = buildSearchChunks(`<h2>Policy</h2><p>${words}</p>`);
    assert.equal(headed.length, 1);
    assert.equal(headed[0].anchor, "policy-0");
  });

  test("ECPay returns Payment Options first", () => {
    const hits = searchPages("ECPay");
    assert.match(hits[0]?.title || "", /Payment Options/i);
  });

  test("HOKI Go returns Payment Options in the top 3", () => {
    const found = titles("HOKI Go").slice(0, 3);
    assert.ok(found.some((title) => /Payment Options/i.test(title)));
  });

  test("convenience-store question returns Payment Options in the top 3", () => {
    const found = titles("can customers pay at a convenience store").slice(0, 3);
    assert.ok(found.some((title) => /Payment Options/i.test(title)));
  });

  test("taxi cancellation question returns the HOKI Taxi General Rule in the top 3", () => {
    const found = titles("what happens if a passenger cancels a taxi reservation").slice(0, 3);
    assert.ok(found.some((title) => title === "HOKI Taxi General Rule"));
  });

  test("delivery fee returns the HOKI Food section with the amount, score, and anchor", () => {
    const hits = searchPages("delivery fee");
    const hit = hits.find((item) => item.title === "HOKI Food General Rule");
    assert.ok(hit);
    assert.match(hit.section, /delivery fee/i);
    assert.match(hit.snippet, /45/);
    assert.equal(typeof hit.score, "number");
    assert.ok(Number.isFinite(hit.score));
    assert.ok(hit.anchor);
    assert.ok(hit.href.endsWith(`#${hit.anchor}`));
    for (const item of hits) {
      assert.equal(typeof item.score, "number");
      assert.ok(item.anchor);
      assert.ok(item.href.includes(`#${item.anchor}`));
    }
  });

  test("collection filter and limit", () => {
    const taxi = searchPages("fee", { collection: "HOKI Taxi" });
    assert.ok(taxi.length >= 1);
    assert.ok(taxi.every((hit) => hit.collection_name === "HOKI Taxi"));
    const byId = searchPages("fee", { collection: taxiId });
    assert.deepEqual(byId.map((hit) => hit.id), taxi.map((hit) => hit.id));
    assert.equal(searchPages("fee", { collection: "HOKI Taxi", limit: 1 }).length, 1);
    assert.equal(searchPages("limitprobe").length, 5);
    assert.equal(searchPages("limitprobe", { limit: 2 }).length, 2);
    assert.equal(searchPages("limitprobe", { limit: 100 }).length, 20);
  });

  test("at most two sections from the same page", () => {
    const hits = searchPages("zebraquota", { limit: 20 });
    assert.ok(hits.length >= 1);
    assert.ok(hits.length <= 2);
    assert.ok(hits.every((hit) => hit.title === "Many Sections"));
  });

  test("a query that only shares a common word returns nothing", () => {
    const hits = searchPages("employee annual leave policy");
    assert.deepEqual(hits, []);
  });

  test("a natural-language question keeps a page that only matches two of its words", () => {
    const hits = searchPages("what happens if a passenger cancels a taxi reservation");
    const found = hits.slice(0, 3).map((hit) => hit.title);
    assert.ok(
      found.includes("Ride Cancellation Rule"),
      `expected Ride Cancellation Rule in the top 3, got ${JSON.stringify(found)}`
    );
    // The noise around it must still be filtered out.
    assert.ok(hits.every((hit) => hit.score >= NOISE_SCORE_FLOOR));
  });

  test("the cutoff separates real matches from accidental overlaps", () => {
    // Bands measured on the production wiki (2026-10-30): one shared word
    // scores 21-28, a real match 50-106.
    assert.equal(keepSearchHit(2, 5, 49.9), true, "taxi answer must survive");
    assert.equal(keepSearchHit(1, 5, 24.2), false, "unrelated taxi section");
    assert.equal(keepSearchHit(1, 5, 23.0), false);
    assert.equal(keepSearchHit(1, 4, 28.1), false, "privacy-policy noise");
    assert.equal(keepSearchHit(1, 4, 26.8), false);
    assert.equal(keepSearchHit(1, 1, 103.9), true, "ECPay");
    assert.equal(keepSearchHit(2, 2, 102.8), true, "HOKI Go");
    assert.equal(keepSearchHit(3, 4, 81.8), true, "convenience store");
    assert.equal(keepSearchHit(2, 2, 105.7), true, "delivery fee");
    assert.equal(keepSearchHit(0, 3, 90.0), false, "no word overlap can never pass");
    assert.equal(keepSearchHit(2, 5, 0), false, "no score can never pass");
  });

  test("below the noise floor nothing survives, however many words it shares", () => {
    assert.equal(keepSearchHit(3, 4, NOISE_SCORE_FLOOR - 0.1), false);
    assert.equal(keepSearchHit(1, 4, NOISE_SCORE_FLOOR - 0.1), false);
    assert.equal(keepSearchHit(0, 0, 999), false);
  });

  test("between the two floors a single shared word is not enough", () => {
    const between = MIN_SEARCH_SCORE - 0.1;
    assert.equal(keepSearchHit(1, 2, between), false, "one of two words is just one word");
    assert.equal(keepSearchHit(1, 5, between), false);
    assert.equal(keepSearchHit(2, 5, between), true, "two of five is the taxi case");
  });

  test("saving or publishing reindexes, and a full rebuild restores the index", () => {
    const id = addPage(probeId, "Cafeteria", "<p>magenta reindex token</p>");
    assert.ok(searchPages("magenta reindex token").length >= 1);

    db.prepare("UPDATE pages SET content_html = ? WHERE id = ?").run("<h2>Menu</h2><p>soup of the day</p>", id);
    syncPageSearch(id);
    assert.equal(searchPages("magenta reindex token").length, 0);
    const menu = searchPages("soup of the day");
    assert.ok(menu.some((hit) => hit.section === "Menu" && hit.anchor));

    db.prepare("UPDATE pages SET status = 'draft' WHERE id = ?").run(id);
    syncPageSearch(id);
    assert.equal(searchPages("soup of the day").length, 0);

    db.prepare("DELETE FROM page_search").run();
    assert.equal(searchPages("ECPay").length, 0);
    ensureSearchIndex();
    assert.match(searchPages("ECPay")[0]?.title || "", /Payment Options/i);
    assert.equal(searchPages("employee annual leave policy").length, 0);
  });
});
