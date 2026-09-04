import { createHmac, timingSafeEqual } from "crypto";
import { spawn } from "child_process";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { NextRequest } from "next/server";

const repoRoot = resolve(process.cwd());
const deployScript = resolve(repoRoot, "scripts/auto-deploy.js");
const lockFile = resolve(repoRoot, "data/deploy.lock");
const WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET || "";
const ALLOWED_REPO = "DarylAndrian/xinchuan-knowledge";
const ALLOWED_BRANCH = "refs/heads/main";

/** Constant-time HMAC-SHA256 verification (same as CloudDrive). */
function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function deployRunning(): boolean {
  if (!existsSync(lockFile)) return false;
  try {
    const ageMs = Date.now() - statSync(lockFile).mtimeMs;
    return ageMs < 15 * 60 * 1000; // stale after 15 min
  } catch {
    return false;
  }
}

/**
 * In-memory burst guard ONLY (the lock file is the real single-flight guard).
 * CRITICAL: this flag must self-reset. A deploy can end without restarting
 * this process (the "noop" path: no new commits -> no pm2 restart), so a flag
 * that only clears on process death stays stuck forever and blocks every
 * future deploy. Reset after 60s — long enough to swallow GitHub delivery
 * retries/bursts, short enough to never strand the pipeline.
 */
let deployInFlight = false;
let deployInFlightTimer: ReturnType<typeof setTimeout> | null = null;
function setDeployInFlight() {
  deployInFlight = true;
  if (deployInFlightTimer) clearTimeout(deployInFlightTimer);
  deployInFlightTimer = setTimeout(() => {
    deployInFlight = false;
    deployInFlightTimer = null;
  }, 60_000);
}

export async function POST(request: NextRequest) {
  // 0. Secret check — refuse if not configured
  if (!WEBHOOK_SECRET) {
    return Response.json(
      { error: "DEPLOY_WEBHOOK_SECRET not configured" },
      { status: 503 }
    );
  }

  // 1. Read raw body for signature verification
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.warn("deploy webhook: signature verification FAILED");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Event filter
  const event = request.headers.get("x-github-event");
  if (event === "ping") {
    return Response.json({ message: "pong -- webhook secret verified" });
  }
  if (event !== "push") {
    return Response.json({ message: `ignored event: ${event}` }, { status: 202 });
  }

  // 3. Parse body for repo/branch filters
  let body: any = {};
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoFull = body?.repository?.full_name;
  if (repoFull !== ALLOWED_REPO) {
    console.warn("deploy webhook: wrong repository", repoFull);
    return Response.json({ error: "Wrong repository" }, { status: 403 });
  }

  const ref = body.ref;
  if (ref !== ALLOWED_BRANCH) {
    return Response.json({ message: `ignored branch: ${ref}` }, { status: 202 });
  }

  // 4. Single-flight guard
  if (deployRunning() || deployInFlight) {
    return Response.json(
      { message: "deploy already in progress" },
      { status: 202 }
    );
  }

  // 5. Spawn detached deploy script (self-resetting burst guard)
  const head = (body.after || "").slice(0, 8);
  const pusher = body?.pusher?.name || body?.pusher?.email || "unknown";
  const meta = JSON.stringify({
    triggeredBy: "github-webhook",
    commit: body.after || null,
    ref,
    pusher,
    deliveryId: request.headers.get("x-github-delivery") || null,
  });

  setDeployInFlight();
  const child = spawn(process.execPath, [deployScript, meta], {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  console.log(
    `deploy webhook: spawned deploy for ${head} by ${pusher} (pid ${child.pid})`
  );

  return Response.json({
    message: `deploy triggered for ${head}`,
    pid: child.pid,
  });
}
