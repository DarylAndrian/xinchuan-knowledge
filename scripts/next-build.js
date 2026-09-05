#!/usr/bin/env node
/**
 * Production `next build` wrapper.
 *
 * `next build` with NODE_ENV=development is treated as non-standard and
 * exits 1. Auto-deploy used to inherit that value from a global env scrub
 * meant only for `npm install`. Always force production here so a build
 * succeeds even when the parent process has the wrong NODE_ENV.
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
  windowsHide: true,
});

process.exit(result.status === null ? 1 : result.status);
