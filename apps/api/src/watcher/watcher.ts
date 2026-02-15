import fs from "node:fs/promises";
import path from "node:path";

import type { Repositories } from "@graph-ai-tutor/db";

import { indexFile } from "./indexer";
import { parseMdFile } from "./parser";

export type WatcherOptions = {
  vaultDir: string;
  repos: Repositories;
  onReindex?: (conceptIds: string[]) => void;
};

export type VaultWatcher = {
  close: () => Promise<void>;
};

export async function startVaultWatcher(
  opts: WatcherOptions
): Promise<VaultWatcher> {
  const { vaultDir, repos, onReindex } = opts;

  // Build initial backlink map by scanning existing files
  const backlinkMap = new Map<string, Set<string>>();

  async function scanDir(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await scanDir(full)));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
    return files;
  }

  // Initial scan: parse-only, no DB writes. Just build backlink map.
  try {
    const mdFiles = await scanDir(vaultDir);
    for (const filePath of mdFiles) {
      try {
        const content = await fs.readFile(filePath, "utf8");
        const parsed = parseMdFile(content);
        const sourceTitle =
          parsed.frontmatter.title || titleFromPath(filePath);
        for (const link of parsed.wikiLinks) {
          const set =
            backlinkMap.get(link.toLowerCase()) ?? new Set<string>();
          set.add(sourceTitle.toLowerCase());
          backlinkMap.set(link.toLowerCase(), set);
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Vault dir may not exist yet
  }

  async function handleFile(filePath: string) {
    if (!filePath.endsWith(".md")) return;

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      return;
    }

    const parsed = parseMdFile(content);
    const result = await indexFile(repos, filePath, parsed);

    // Update backlink map
    const fileTitle =
      parsed.frontmatter.title || titleFromPath(filePath);
    for (const link of parsed.wikiLinks) {
      const set =
        backlinkMap.get(link.toLowerCase()) ?? new Set<string>();
      set.add(fileTitle.toLowerCase());
      backlinkMap.set(link.toLowerCase(), set);
    }

    if (onReindex) {
      onReindex([result.conceptId]);
    }
  }

  async function handleUnlink(filePath: string) {
    if (!filePath.endsWith(".md")) return;
    // On file removal, we don't delete concepts (they may have other references).
    // Just notify about possible stale data.
    const title = titleFromPath(filePath);
    // Remove from backlink map
    for (const [, set] of backlinkMap) {
      set.delete(title.toLowerCase());
    }
  }

  // Dynamic import to allow the module to be optional
  let chokidar: typeof import("chokidar");
  try {
    chokidar = await import("chokidar");
  } catch {
    throw new Error(
      "chokidar is required for vault watching. Install it with: pnpm add chokidar"
    );
  }

  const usePolling =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";

  const watcher = chokidar.watch(path.join(vaultDir, "**/*.md"), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
    ...(usePolling ? { usePolling: true, interval: 100 } : {})
  });

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      watcher.off("ready", onReady);
      watcher.off("error", onError);
      resolve();
    };
    const onError = (err: unknown) => {
      watcher.off("ready", onReady);
      watcher.off("error", onError);
      reject(err);
    };
    watcher.on("ready", onReady);
    watcher.on("error", onError);
  });

  watcher.on("add", (filePath: string) => {
    void handleFile(filePath);
  });
  watcher.on("change", (filePath: string) => {
    void handleFile(filePath);
  });
  watcher.on("unlink", (filePath: string) => {
    void handleUnlink(filePath);
  });

  return {
    async close() {
      await watcher.close();
    }
  };
}

function titleFromPath(filePath: string): string {
  const base = path.basename(filePath, ".md");
  return base
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
