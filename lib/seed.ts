import bcrypt from "bcryptjs";
import { generateJSON } from "@tiptap/html";
import type { DatabaseSync } from "node:sqlite";
import { editorExtensions } from "./extensions";

const DEPLOY_CHECKLIST_HTML = `
<h2>1. Overview</h2>
<p>This checklist applies to <strong>every production release</strong> of the platform services. A release is only “done” when every box below is checked and the deploy log entry is linked in #releases.</p>
<blockquote><p><strong>Rule of thumb:</strong> if any pre-flight check fails, the release is aborted — not “fixed forward”. Hotfixes follow the Rollback Playbook.</p></blockquote>
<h2>2. Pre-flight checks</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>All CI pipelines green on the release branch</p></li>
  <li data-type="taskItem" data-checked="true"><p>Database migrations reviewed and dry-run in staging</p></li>
  <li data-type="taskItem" data-checked="false"><p>Feature flags configured for the rollout window</p></li>
  <li data-type="taskItem" data-checked="false"><p>On-call engineer confirmed and reachable</p></li>
</ul>
<h2>3. Deployment steps</h2>
<h3>3.1 Cut the release</h3>
<p>Tag the release from the release branch. Tags follow <code>vYYYY.MM.PATCH</code> calver.</p>
<pre><code># create + push the release tag
git tag -a v2026.09.1 -m "release: September patch 1"
git push origin v2026.09.1

# trigger the deploy pipeline
deploy run --env prod --tag v2026.09.1 --confirm</code></pre>
<h3>3.2 Verify &amp; monitor</h3>
<p>Watch the release dashboard for <strong>30 minutes</strong>. Roll back immediately on error-rate &gt; 0.5% or p95 latency regression &gt; 20%.</p>
<blockquote><p>Never deploy migrations and application code in the same window without a tested rollback path.</p></blockquote>
<h2>4. Roles &amp; responsibilities</h2>
<table>
  <thead><tr><th>Role</th><th>Responsibility</th><th>Backup</th></tr></thead>
  <tbody>
    <tr><td>Release Lead</td><td>Owns the checklist, calls go/no-go</td><td>On-call engineer</td></tr>
    <tr><td>On-call Engineer</td><td>Monitors dashboards during window</td><td>Second on-call</td></tr>
    <tr><td>Scribe</td><td>Writes the deploy log entry</td><td>Release Lead</td></tr>
  </tbody>
</table>
<h2>5. Where do deploy logs live?</h2>
<p>Deploy logs are stored in <code>/ops/deploy-log/</code> as one Markdown file per release, and mirrored to the #releases channel.</p>
`;

const API_ERRORS_HTML = `
<h2>Conventions</h2>
<p>Every API error response must carry a machine-readable <code>code</code>, a human-readable <code>message</code>, and — for 4xx responses — a <code>details</code> array pointing at the offending fields.</p>
<pre><code>{
  "code": "validation_failed",
  "message": "The request body failed validation.",
  "details": [{ "field": "email", "issue": "not a valid address" }]
}</code></pre>
<h2>Status codes</h2>
<table>
  <thead><tr><th>Situation</th><th>Status</th></tr></thead>
  <tbody>
    <tr><td>Bad input</td><td>400</td></tr>
    <tr><td>Not authenticated</td><td>401</td></tr>
    <tr><td>Forbidden</td><td>403</td></tr>
    <tr><td>Not found</td><td>404</td></tr>
    <tr><td>Upstream failure</td><td>502</td></tr>
  </tbody>
</table>
`;

const OVERVIEW_HTML = `
<p>Everything about how we build: architecture decisions, coding standards, and the runbooks we follow when things go sideways.</p>
<blockquote><p>New here? Start with the Standards section, then read the Deployment Checklist before your first release.</p></blockquote>
<h2>Quick links</h2>
<ul>
  <li><p>API Error Handling — the response contract every service follows</p></li>
  <li><p>Deployment Checklist — what must be true before code ships</p></li>
</ul>
`;

function payRow(provider: string, providerRows: number, company: string, companyRows: number, accounts: string[]): string {
  return accounts
    .map((acc, i) => {
      const pCell = i === 0 && providerRows > 1 ? `<td rowspan="${providerRows}"><strong>${provider}</strong></td>` : "";
      const cCell = i === 0 ? `<td${companyRows > 1 ? ` rowspan="${companyRows}"` : ""}>${company}</td>` : "";
      return `<tr>${pCell}${cCell}<td>${acc || "—"}</td></tr>`;
    })
    .join("");
}

function buildPaymentHtml(): string {
  const head = `<table><thead><tr><th>Provider</th><th>Company</th><th>Account No.</th></tr></thead><tbody>`;
  const heimao = payRow("Heimao", 5, "Xinchuan Management", 1, ["829278920001"])
    + payRow("Heimao", 5, "Xinchuan Telecom", 2, ["540204690001", "540204690002"]).replace(/<td rowspan="5"><strong>Heimao<\/strong><\/td>/, "")
    + payRow("Heimao", 5, "Huang Dajin", 1, ["908453310001"]).replace(/<td rowspan="5"><strong>Heimao<\/strong><\/td>/, "")
    + payRow("Heimao", 5, "HOKI Go", 1, ["810357520001"]).replace(/<td rowspan="5"><strong>Heimao<\/strong><\/td>/, "");
  const ecpay = payRow("ECPay", 6, "Xinchuan Management", 3, ["x82927892", "XCECP@HOKI888", "82927892"])
    + payRow("ECPay", 6, "HOKI Go", 3, ["Hokifood888", "Aa072369500@", "81035752"]).replace(/<td rowspan="6"><strong>ECPay<\/strong><\/td>/, "");

  const section = (title: string, note: string, body: string) =>
    `<h2>${title}</h2><p>${note}</p>${head}${body}</tbody></table>`;

  return `
<blockquote><p><strong>How to read this page:</strong> each channel lists its providers → company accounts → account numbers. This page is the single source of truth — do not rely on older screenshots or chat messages.</p></blockquote>
${section("1. 7-Eleven", "Convenience-store barcode payments through Heimao and Taishin.",
  heimao + payRow("Taishin", 1, "Xinchuan Management", 1, ["82927892001"]))}
${section("2. Family Mart", "Family Mart counter payments.",
  payRow("Family Mart", 2, "Xinchuan Management", 1, [""]) + payRow("Taishin", 2, "Xinchuan Management", 1, ["82927892001"]).replace(/<td rowspan="1"><strong>Taishin<\/strong><\/td>|<td rowspan="2"><strong>Taishin<\/strong><\/td>/, ""))}
${section("3. Virtual Account", "Bank virtual account transfers.",
  heimao + payRow("Taishin", 1, "Xinchuan Management", 1, ["82927892001"]) + ecpay)}
${section("4. Credit Card", "Card payments processed per provider.",
  heimao + ecpay)}
${section("5. Hi-Life", "Hi-Life counter payments.", payRow("Hi-Life", 1, "Xinchuan Management", 1, [""]))}
${section("6. OK Mart", "OK Mart counter payments.", payRow("OK Mart", 1, "Xinchuan Management", 1, [""]))}
`;
}

export function seedIfNeeded(database: DatabaseSync): void {
  const { count } = database.prepare("SELECT COUNT(*) AS count FROM users").get() as unknown as { count: number };
  if (count > 0) return;

  database.exec("BEGIN");
  try {
    seedAll(database);
    database.exec("COMMIT");
  } catch (err) {
    try { database.exec("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  }
}

function seedAll(database: DatabaseSync): void {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const email = process.env.SUPERADMIN_EMAIL || "admin@xinchuan.local";
  const password = process.env.SUPERADMIN_PASSWORD || "xinchuan-admin";

  const insertUser = database.prepare(
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)"
  );
  const superadminId = Number(insertUser.run(email, "Sarah Admin", hash(password), "superadmin").lastInsertRowid);
  const danaId = Number(insertUser.run("dana@xinchuan.local", "Dana Writer", hash("xinchuan-admin"), "admin").lastInsertRowid);
  const mikaId = Number(insertUser.run("mika@xinchuan.local", "Mika Reader", hash("xinchuan-comment"), "commentator").lastInsertRowid);

  const insertCollection = database.prepare(
    "INSERT INTO collections (name, slug, description, icon, position) VALUES (?, ?, ?, ?, ?)"
  );
  const engId = Number(insertCollection.run("Engineering", "engineering", "Architecture, standards, runbooks and everything about how we build.", "wrench", 0).lastInsertRowid);
  const finId = Number(insertCollection.run("Finance", "finance", "Payment options, refunds, reconciliation and invoicing.", "credit-card", 1).lastInsertRowid);

  const insertPage = database.prepare(
    `INSERT INTO pages (collection_id, parent_id, title, slug, icon, content_json, content_html, status, position, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
  );

  const toDoc = (html: string) => JSON.stringify(generateJSON(html, editorExtensions));

  const overviewId = Number(insertPage.run(engId, null, "Overview", "overview", "home", toDoc(OVERVIEW_HTML), OVERVIEW_HTML, 0, superadminId).lastInsertRowid);
  const standardsId = Number(insertPage.run(engId, null, "Standards", "standards", "ruler", toDoc("<p>Coding and API conventions shared by every service.</p>"), "<p>Coding and API conventions shared by every service.</p>", 1, danaId).lastInsertRowid);
  insertPage.run(engId, standardsId, "API Error Handling", "api-error-handling", "file-text", toDoc(API_ERRORS_HTML), API_ERRORS_HTML, 0, danaId);
  const runbooksId = Number(insertPage.run(engId, null, "Runbooks", "runbooks", "rocket", toDoc("<p>Step-by-step procedures for shipping and recovering.</p>"), "<p>Step-by-step procedures for shipping and recovering.</p>", 2, danaId).lastInsertRowid);
  const checklistId = Number(insertPage.run(engId, runbooksId, "Deployment Checklist — Production", "deployment-checklist", "rocket", toDoc(DEPLOY_CHECKLIST_HTML), DEPLOY_CHECKLIST_HTML, 0, danaId).lastInsertRowid);

  const paymentId = Number(insertPage.run(finId, null, "Payment", "payment", "credit-card", toDoc("<p>All payment channels and procedures.</p>"), "<p>All payment channels and procedures.</p>", 0, danaId).lastInsertRowid);
  insertPage.run(finId, paymentId, "Current Available Payment Options", "payment-options", "credit-card", toDoc(buildPaymentHtml()), buildPaymentHtml(), 1, danaId);

  const insertComment = database.prepare(
    "INSERT INTO comments (page_id, author_id, parent_id, quote, body, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const c1 = Number(insertComment.run(checklistId, mikaId, null, "the deploy log entry is linked in #releases", "Should this also link the release dashboard snapshot? Last time the log pointed at a dead dashboard URL.", datetime(-2)).lastInsertRowid);
  insertComment.run(checklistId, danaId, c1, "", "Good catch — adding the snapshot requirement in the next revision.", datetime(-2));
  insertComment.run(checklistId, danaId, null, "On-call engineer confirmed and reachable", "“Reachable” means PagerDuty ack within 5 min — let’s spell that out.", datetime(-1));

  database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'Xinchuan Knowledge Center'), ('public_viewing', '1')").run();
}

function datetime(daysAgo: number): string {
  return new Date(Date.now() + daysAgo * 86400000).toISOString().replace("T", " ").slice(0, 19);
}
