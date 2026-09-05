#!/usr/bin/env node
/**
 * xinchuan-knowledge auto-deploy (GitHub webhook-triggered).
 *
 * Entry points:
 *   node scripts/auto-deploy.js '<meta-json>'    build phase
 *   node scripts/auto-deploy.js --finish '<meta-json>'
 *                                             finish phase (post-restart)
 *
 * Two-phase design: the build phase ends by restarting THIS app via pm2,
 * and on Windows pm2 can kill the deploy process tree during that restart.
 * So the build phase spawns a DETACHED finisher before calling pm2 restart;
 * the finisher survives the restart, verifies localhost:3001 is healthy,
 * writes the final status and removes the lock.
 *
 * Artifacts:
 *   logs/auto-deploy.log         append-only run log (truncated at 5 MB)
 *   data/deploy-status.json      machine-readable last-deploy status
 *   data/deploy.lock             single-flight guard (stale after 15 min)
 */

"use strict";

const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const LOG_DIR = path.join(REPO, "logs");
const DATA_DIR = path.join(REPO, "data");
const LOG_FILE = path.join(LOG_DIR, "auto-deploy.log");
const STATUS_FILE = path.join(DATA_DIR, "deploy-status.json");
const LOCK_FILE = path.join(DATA_DIR, "deploy.lock");
const HEALTH_URL = "http://localhost:3001";
const HEALTH_TIMEOUT_MS = 120 * 1000;
const STALE_LOCK_MS = 15 * 60 * 1000;

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ------------------------------------------------------------------ logging
function truncateLogIfNeeded() {
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size > 5 * 1024 * 1024) {
      const buf = fs.readFileSync(LOG_FILE);
      fs.writeFileSync(LOG_FILE, buf.subarray(buf.length - 1024 * 1024));
    }
  } catch (_e) { /* first run */ }
}
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch (_e) {}
}

// ------------------------------------------------------------------ env/PATH
function baseEnv() {
  const extra = [
    path.dirname(process.execPath),
    "C:\\Program Files\\nodejs",
    "C:\\Program Files\\Git\\cmd",
    "C:\\Program Files\\Git\\bin",
    path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      "AppData\\Local\\hermes\\git\\usr\\bin"
    ),
  ];
  const pathSep = process.platform === "win32" ? ";" : ":";
  return {
    ...process.env,
    PATH: extra.join(pathSep) + pathSep + (process.env.PATH || ""),
    GIT_TERMINAL_PROMPT: "0",
    GIT_EDITOR: "true",
  };
}

// Webhook inherits NODE_ENV=production from pm2/Next. `npm install` then
// skips devDependencies (tailwindcss, …) unless we drop it. Do NOT set
// NODE_ENV=development globally: `next build` with that value is treated
// as non-standard and Next.js exits 1.
function installEnv() {
  const env = baseEnv();
  delete env.NODE_ENV;
  return env;
}

function productionEnv() {
  const env = baseEnv();
  env.NODE_ENV = "production";
  return env;
}

// ------------------------------------------------------------------ helpers
function sh(label, cmd, opts = {}) {
  log(`[run] ${label}: ${cmd}`);
  const result = spawnSync(cmd, {
    shell: true,
    cwd: REPO,
    env: opts.env || baseEnv(),
    timeout: opts.timeout || 300_000,
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.stdout) log(`[out] ${result.stdout.trim().split("\n").join("\n[out] ")}`);
  if (result.stderr) log(`[err] ${result.stderr.trim().split("\n").join("\n[err] ")}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    const tail = detail.split(/\r?\n/).slice(-12).join(" | ");
    throw new Error(`${label} failed (exit ${result.status}): ${tail}`);
  }
  return result;
}

function writeStatus(status, meta) {
  const data = {
    ...meta,
    status,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
  log(`[status] ${status}`);
}

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (age < STALE_LOCK_MS) {
        log("[skip] another deploy is already running (lock not stale)");
        return false;
      }
      log("[warn] removing stale lock (older than 15 min)");
    } catch (_e) {}
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_e) {}
}

function healthCheck() {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed > HEALTH_TIMEOUT_MS) {
        clearInterval(interval);
        resolve(false);
        return;
      }
      const req = http.get(HEALTH_URL, { timeout: 10_000 }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 307) {
          clearInterval(interval);
          log(`[health] OK (HTTP ${res.statusCode} after ${elapsed}ms)`);
          resolve(true);
        }
        res.resume();
      });
      req.on("error", () => { /* not ready yet */ });
      req.on("timeout", () => { req.destroy(); });
    }, 3000);
  });
}

// ================================================================ FINISH PHASE
// Runs as a detached child. Survives the pm2 restart that kills its parent.
if (process.argv[2] === "--finish") {
  let meta = {};
  try { meta = JSON.parse(process.argv[3] || "{}"); } catch (_e) {}

  (async () => {
    log("[finish] waiting for server to come back up...");
    const healthy = await healthCheck();
    if (!healthy) {
      log("[finish] HEALTH CHECK FAILED — attempting rollback");
      try {
        // Rollback: checkout previous commit, rebuild, restart
        sh("rollback: git checkout", `git -C "${REPO}" checkout HEAD~1`);
        sh("rollback: npm install", `npm install --prefer-offline --include=dev`, { timeout: 120_000, env: installEnv() });
        sh("rollback: npm build", `npm run build`, { timeout: 300_000, env: productionEnv() });
        sh("rollback: pm2 restart", `pm2 restart xinchuan`);
        const rollbackOk = await healthCheck();
        writeStatus(rollbackOk ? "rollback-ok" : "rollback-failed", meta);
      } catch (e) {
        log(`[finish] rollback error: ${e.message}`);
        writeStatus("rollback-error", { ...meta, error: e.message });
      }
    } else {
      writeStatus("ok", meta);
    }
    releaseLock();
    log("[finish] done");
    process.exit(0);
  })();
  return;
}

// ================================================================ BUILD PHASE
const meta = (() => { try { return JSON.parse(process.argv[2] || "{}"); } catch (_e) { return {}; } })();

truncateLogIfNeeded();
log("=== auto-deploy started ===");
log(`meta: ${JSON.stringify(meta)}`);

if (!acquireLock()) {
  process.exit(0);
}

try {
  // 1. Sync to remote. fetch + reset --hard (NOT git pull): this is a
  //    deploy-only machine — the tree must always mirror origin/main exactly.
  //    A plain pull aborts when any local file is dirty (e.g. package-lock.json
  //    rewritten by npm install after a version bump), which jammed every
  //    subsequent deploy on 2026-09-04. reset --hard is immune to that.
  const preCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8", windowsHide: true }).stdout.trim();
  sh("git fetch", "git fetch origin main", { timeout: 120_000 });
  sh("git reset", "git reset --hard origin/main");
  const postCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8", windowsHide: true }).stdout.trim();

  if (preCommit === postCommit) {
    log("[skip] no new commits — skipping build");
    writeStatus("noop", { ...meta, commit: preCommit });
    releaseLock();
    process.exit(0);
  }

  log(`[deploy] ${preCommit.slice(0, 8)} -> ${postCommit.slice(0, 8)}`);

  // 2. npm install (always — repairs any drift in node_modules; a dirty
  //    lockfile afterwards is harmless since step 1 wipes local changes).
  //    --include=dev plus a cleared NODE_ENV so production env does not
  //    omit tailwindcss/postcss. Build uses NODE_ENV=production separately.
  sh("npm install", "npm install --prefer-offline --include=dev", { timeout: 120_000, env: installEnv() });

  // 3. Fresh build — wipe the .next cache first. Stale webpack cache can
  //    produce phantom "Module not found" errors for files that exist.
  try { fs.rmSync(path.join(REPO, ".next"), { recursive: true, force: true }); } catch (_e) {}
  sh("npm build", "npm run build", { timeout: 300_000, env: productionEnv() });

  // 4. Spawn finisher (detached — survives the pm2 restart below)
  const finisher = spawn(process.execPath, [__filename, "--finish", JSON.stringify({ ...meta, commit: postCommit })], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
    env: productionEnv(),
    windowsHide: true,
  });
  finisher.unref();
  log(`[deploy] spawned finisher (pid ${finisher.pid})`);

  // 5. pm2 restart (kills this process tree — finisher survives)
  sh("pm2 restart", "pm2 restart xinchuan");
} catch (e) {
  log(`[deploy] ERROR: ${e.message}`);
  writeStatus("failed", { ...meta, error: e.message });
  releaseLock();
  process.exit(1);
}
