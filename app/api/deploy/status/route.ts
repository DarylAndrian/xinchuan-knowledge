import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/deploy/status
 * Public (like CloudDrive's): contains no secrets, only commit hashes and
 * step timings. Answers "did my push deploy?" from any device.
 */
export async function GET() {
  const repoRoot = resolve(process.cwd());
  const statusFile = resolve(repoRoot, "data/deploy-status.json");
  const lockFile = resolve(repoRoot, "data/deploy.lock");

  let lastDeploy: unknown = null;
  try {
    lastDeploy = JSON.parse(readFileSync(statusFile, "utf8"));
  } catch {
    /* no deploy has run yet */
  }

  // A deploy is in flight while the lock file is fresh (script owns it for
  // the whole run; stale after 15 min if the process died hard).
  let inFlight = false;
  if (existsSync(lockFile)) {
    try {
      inFlight = Date.now() - statSync(lockFile).mtimeMs < 15 * 60 * 1000;
    } catch {
      inFlight = false;
    }
  }

  return Response.json({ enabled: true, inFlight, lastDeploy });
}
