import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";

const source = path.join(process.cwd(), "data");
const dataDir = mkdtempSync(path.join(tmpdir(), "xk-live-"));
for (const name of ["xinchuan.db", "xinchuan.db-wal", "xinchuan.db-shm"]) {
  const from = path.join(source, name);
  if (existsSync(from)) copyFileSync(from, path.join(dataDir, name));
}
process.env.XINCHUAN_DATA_DIR = dataDir;

const live = existsSync(path.join(dataDir, "xinchuan.db"));
const { db } = live ? await import("../lib/db.ts") : { db: null };
const { searchPages } = live ? await import("../lib/pages.ts") : { searchPages: null };

after(() => {
  try { db?.close(); } catch { /* already closed */ }
  rmSync(dataDir, { recursive: true, force: true });
});

describe("published wiki corpus", { concurrency: false }, () => {
  test("ECPay, HOKI Go, convenience stores, and an unknown policy", { skip: !live }, () => {
    const pages = searchPages!("ECPay");
    assert.match(pages[0]?.title || "", /Payment Options/i);

    const hoki = searchPages!("HOKI Go").slice(0, 3);
    assert.ok(hoki.some((hit) => /Payment Options/i.test(hit.title)));

    const pay = searchPages!("can customers pay at a convenience store").slice(0, 3);
    assert.ok(pay.some((hit) => /Payment Options/i.test(hit.title)));

    assert.deepEqual(searchPages!("employee annual leave policy"), []);

    const food = searchPages!("delivery fee");
    const foodHit = food.find((hit) => /HOKI Food General Rule/i.test(hit.title));
    if (foodHit) {
      assert.match(foodHit.snippet, /\d/);
      assert.ok(foodHit.anchor);
      assert.equal(typeof foodHit.score, "number");
    }
    for (const hit of food) {
      assert.equal(typeof hit.score, "number");
      assert.ok(hit.anchor);
    }

    const taxi = searchPages!("what happens if a passenger cancels a taxi reservation").slice(0, 3);
    const taxiPage = db!.prepare(
      "SELECT id FROM pages WHERE title LIKE '%HOKI Taxi General Rule%' AND status = 'published'"
    ).get();
    if (taxiPage) assert.ok(taxi.some((hit) => /HOKI Taxi General Rule/i.test(hit.title)));

    const taxiCollection = db!.prepare("SELECT id FROM collections WHERE name = 'HOKI Taxi'").get();
    if (taxiCollection) {
      const fees = searchPages!("fee", { collection: "HOKI Taxi", limit: 20 });
      assert.ok(fees.every((hit) => hit.collection_name === "HOKI Taxi"));
      assert.ok(fees.length <= 20);
    }
  });
});
