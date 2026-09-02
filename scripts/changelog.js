#!/usr/bin/env node
/**
 * Changelog management — zero dependencies.
 *
 * Usage:
 *   node scripts/changelog.js add [Added|Changed|Fixed|Removed|Deprecated|Security] "entry text"
 *   node scripts/changelog.js bump [patch|minor|major]
 *
 * `add`  appends an entry under the given section of `## [Unreleased]` in CHANGELOG.md
 *        (creating the subsection if needed).
 * `bump` bumps `version` in package.json, moves everything under `## [Unreleased]`
 *        into a new `## [x.y.z] - YYYY-MM-DD` section, and opens a fresh Unreleased section.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CHANGELOG = path.join(ROOT, "CHANGELOG.md");
const PKG = path.join(ROOT, "package.json");

const SECTIONS = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addEntry(section, text) {
  const type = SECTIONS.find((s) => s.toLowerCase() === section.toLowerCase());
  if (!type) {
    console.error(`Unknown section "${section}". Use one of: ${SECTIONS.join(", ")}`);
    process.exit(1);
  }
  let md = read(CHANGELOG);
  const unreleasedIdx = md.indexOf("## [Unreleased]");
  if (unreleasedIdx === -1) {
    console.error("No `## [Unreleased]` section found in CHANGELOG.md.");
    process.exit(1);
  }

  // bounds of the Unreleased block
  const nextRelease = md.indexOf("\n## [", unreleasedIdx + 1);
  const blockEnd = nextRelease === -1 ? md.length : nextRelease;
  let block = md.slice(unreleasedIdx, blockEnd);

  const heading = `### ${type}`;
  if (block.includes(heading)) {
    // append at the end of that subsection
    const hIdx = block.indexOf(heading);
    const after = block.slice(hIdx + heading.length);
    const nextSection = after.search(/\n### /);
    const insertAt = nextSection === -1 ? after.length : nextSection;
    block =
      block.slice(0, hIdx + heading.length) +
      after.slice(0, insertAt).replace(/\s+$/, "") +
      `\n- ${text}` +
      after.slice(insertAt);
  } else {
    // insert the subsection after the Unreleased header (order per Keep a Changelog)
    const order = SECTIONS.filter((s) => block.includes(`### ${s}`) || s === type);
    const myPos = order.indexOf(type);
    let anchor = null;
    for (let i = myPos + 1; i < order.length; i++) {
      const idx = block.indexOf(`### ${order[i]}`);
      if (idx !== -1) { anchor = idx; break; }
    }
    const piece = `### ${type}\n\n- ${text}\n`;
    if (anchor === null) {
      block = block.replace(/\s*$/, "\n\n") + piece;
    } else {
      block = block.slice(0, anchor) + piece + "\n" + block.slice(anchor);
    }
  }

  md = md.slice(0, unreleasedIdx) + block + md.slice(blockEnd);
  fs.writeFileSync(CHANGELOG, md);
  console.log(`Added under [Unreleased] → ${type}: ${text}`);
}

function bump(kind) {
  if (!["patch", "minor", "major"].includes(kind)) {
    console.error(`Unknown bump kind "${kind}". Use patch, minor or major.`);
    process.exit(1);
  }
  const pkg = JSON.parse(read(PKG));
  const [maj, min, pat] = pkg.version.split(".").map(Number);
  const next =
    kind === "major" ? `${maj + 1}.0.0` : kind === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

  let md = read(CHANGELOG);
  const marker = "## [Unreleased]";
  const idx = md.indexOf(marker);
  if (idx === -1) {
    console.error("No `## [Unreleased]` section found in CHANGELOG.md.");
    process.exit(1);
  }
  const nextRelease = md.indexOf("\n## [", idx + 1);
  const blockEnd = nextRelease === -1 ? md.length : nextRelease + 1;
  const unreleasedBlock = md.slice(idx + marker.length, blockEnd).trim();

  if (!unreleasedBlock) {
    console.error("Nothing under [Unreleased] — add entries first (npm run changelog:add).");
    process.exit(1);
  }

  const releaseHeader = `## [${next}] - ${today()}`;
  md =
    md.slice(0, idx) +
    `${marker}\n\n${releaseHeader}\n\n${unreleasedBlock}\n\n` +
    md.slice(blockEnd);
  fs.writeFileSync(CHANGELOG, md);

  pkg.version = next;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Released ${next} — CHANGELOG.md stamped, package.json updated.`);
}

const [, , command, a, ...rest] = process.argv;
if (command === "add") {
  if (!a || rest.length === 0) {
    console.error('Usage: changelog.js add [Added|Changed|...] "entry text"');
    process.exit(1);
  }
  addEntry(a, rest.join(" ").replace(/^"|"$/g, ""));
} else if (command === "bump") {
  bump(a || "patch");
} else {
  console.error("Usage: changelog.js <add|bump> ...");
  process.exit(1);
}
