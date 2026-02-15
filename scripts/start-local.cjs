#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function readEnvFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return {};
  }

  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;

    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function run(cmd, args, options) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (res.error) throw res.error;
  if (typeof res.status === "number" && res.status !== 0) {
    process.exit(res.status);
  }
}

function sleep(ms) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgresReady({ cwd, env, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = spawnSync(
      "docker",
      ["compose", "exec", "-T", "db", "pg_isready", "-U", "graph", "-d", "graph_ai_tutor"],
      { cwd, env, stdio: "ignore" }
    );
    if (res.status === 0) return;
    await sleep(500);
  }
  throw new Error("Postgres did not become ready in time");
}

const repoRoot = path.resolve(__dirname, "..");
const envFile = readEnvFile(path.join(repoRoot, ".env"));
const composeEnv = { ...envFile, ...process.env };

const databaseUrl =
  process.env.DATABASE_URL ||
  envFile.DATABASE_URL ||
  "postgres://graph:graph@127.0.0.1:5433/graph_ai_tutor";

function looksLikePath(value) {
  return value.startsWith(".") || value.includes("/") || value.includes("\\");
}

(async () => {
  const pgData = composeEnv.GRAPH_AI_TUTOR_PGDATA;
  if (pgData && looksLikePath(pgData)) {
    const abs = path.isAbsolute(pgData) ? pgData : path.resolve(repoRoot, pgData);
    fs.mkdirSync(abs, { recursive: true });
  }

  run("docker", ["compose", "up", "-d", "db"], { cwd: repoRoot, env: composeEnv });
  await waitForPostgresReady({ cwd: repoRoot, env: composeEnv, timeoutMs: 30_000 });

  run("pnpm", ["dev"], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
