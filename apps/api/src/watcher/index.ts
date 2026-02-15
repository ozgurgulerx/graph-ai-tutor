export { parseMdFile, parseFrontmatter, extractWikiLinks, type ParsedMdFile, type ParsedFrontmatter } from "./parser";
export { indexFile, reindexBacklinks, type IndexFileResult } from "./indexer";
export { startVaultWatcher, type VaultWatcher, type WatcherOptions } from "./watcher";
