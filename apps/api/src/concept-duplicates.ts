import type { Repositories } from "@graph-ai-tutor/db";

const DUPLICATE_SCORE_THRESHOLD = 0.78;
const DUPLICATE_SEARCH_LIMIT = 20;
const TOP_DUPLICATE_MATCHES = 10;
const STOP_WORDS = new Set(["ai", "llm", "genai", "model", "models"]);

type CandidateConceptSummary = {
  id: string;
  title: string;
  kind: string;
  module: string | null;
};

export type DuplicateConceptMatch = {
  id: string;
  title: string;
  kind: string;
  module: string | null;
  score: number;
  reason: string;
};

function normalizeForDuplicateMatch(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) return "";

  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));

  return tokens.length > 0 ? tokens.join(" ") : normalized;
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function buildSearchQueries(rawTitle: string): string[] {
  const normalized = normalizeForDuplicateMatch(rawTitle);
  const rawLower = rawTitle.trim().toLowerCase();
  const tokens = normalized.split(" ").filter(Boolean);
  const firstToken = tokens[0] ?? "";
  const lastToken = tokens[tokens.length - 1] ?? "";

  return uniqueStrings([
    rawTitle.trim(),
    rawLower,
    normalized,
    normalized.includes(" ") ? `${firstToken} ${lastToken}` : "",
    firstToken,
    lastToken
  ]).filter((value) => value.length >= 2);
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = new Array<number>(b.length + 1);
  const previous = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const insertion = row[j - 1] + 1;
      const deletion = previous[j] + 1;
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      row[j] = Math.min(insertion, deletion, substitution);
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = row[j];
    }
  }

  return previous[b.length];
}

function charSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function bigramSimilarity(a: string, b: string): number {
  const toBigrams = (value: string): string[] => {
    const normalized = ` ${value} `;
    if (normalized.length <= 2) return [normalized];
    const out: string[] = [];
    for (let i = 0; i < normalized.length - 1; i++) {
      out.push(normalized.slice(i, i + 2));
    }
    return out;
  };

  const aCounts = new Map<string, number>();
  for (const bigram of toBigrams(a)) {
    aCounts.set(bigram, (aCounts.get(bigram) ?? 0) + 1);
  }

  let intersection = 0;
  const bCounts = new Map<string, number>();
  for (const bigram of toBigrams(b)) {
    bCounts.set(bigram, (bCounts.get(bigram) ?? 0) + 1);
  }

  for (const [bigram, bCount] of bCounts) {
    const aCount = aCounts.get(bigram) ?? 0;
    intersection += Math.min(aCount, bCount);
  }

  const denom = aCounts.size + bCounts.size;
  if (denom === 0) return 1;
  return (2 * intersection) / denom;
}

function tokenOverlapSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  if (union === 0) return 0;
  return intersection / union;
}

function computeDuplicateScore(
  candidate: CandidateConceptSummary,
  target: string,
  targetModule: string | null | undefined,
  targetKind: string | undefined
): { score: number; reason: string } {
  const normalizedTarget = normalizeForDuplicateMatch(target);
  const normalizedCandidate = normalizeForDuplicateMatch(candidate.title);
  if (!normalizedTarget || !normalizedCandidate) return { score: 0, reason: "low-information" };

  if (normalizedCandidate === normalizedTarget) {
    return { score: 1, reason: "normalized_exact" };
  }

  const containsBonus =
    normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate) ? 0.1 : 0;

  let reason = "similar";
  if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
    reason = "contains";
  }

  const charScore = charSimilarity(normalizedTarget, normalizedCandidate);
  const bigramScore = bigramSimilarity(normalizedTarget, normalizedCandidate);
  const tokenScore = tokenOverlapSimilarity(normalizedTarget, normalizedCandidate);

  if (tokenScore >= 0.85) reason = "token_overlap";
  if (charScore >= 0.92) reason = "typo_close";

  let score = 0.45 * charScore + 0.35 * bigramScore + 0.2 * tokenScore + containsBonus;
  if (targetModule && candidate.module && targetModule === candidate.module) score += 0.05;
  if (targetKind && candidate.kind === targetKind) score += 0.02;

  return { score: Math.min(1, score), reason };
}

function toCandidateMatch(match: DuplicateConceptMatch & { id: string }): DuplicateConceptMatch {
  return {
    id: match.id,
    title: match.title,
    kind: match.kind,
    module: match.module,
    score: match.score,
    reason: match.reason
  };
}

export async function findPotentialDuplicateConcepts(input: {
  repos: Repositories;
  title: string;
  module?: string | null;
  kind?: string;
  searchLimit?: number;
}): Promise<DuplicateConceptMatch[]> {
  const searchLimit = input.searchLimit ?? DUPLICATE_SEARCH_LIMIT;
  const normalized = normalizeForDuplicateMatch(input.title);
  if (!normalized) return [];

  const queries = buildSearchQueries(input.title);
  if (queries.length === 0) return [];

  const matches = new Map<string, CandidateConceptSummary>();

  await Promise.all(
    queries.map(async (query) => {
      const [exactRows, summaryRows] = await Promise.all([
        input.repos.concept.searchExact(query, searchLimit).catch(() => []),
        input.repos.concept.searchSummaries(query, searchLimit).catch(() => [])
      ]);

      for (const row of exactRows) {
        matches.set(row.id, {
          id: row.id,
          title: row.title,
          kind: row.kind ?? "Concept",
          module: row.module ?? null
        });
      }
      for (const row of summaryRows) {
        matches.set(row.id, {
          id: row.id,
          title: row.title,
          kind: row.kind ?? "Concept",
          module: row.module ?? null
        });
      }
    })
  );

  const duplicateCandidates: DuplicateConceptMatch[] = [];
  for (const candidate of matches.values()) {
    const scored = computeDuplicateScore(candidate, normalized, input.module, input.kind);
    if (scored.score < DUPLICATE_SCORE_THRESHOLD) continue;
    duplicateCandidates.push(
      toCandidateMatch({
        ...candidate,
        id: candidate.id,
        score: scored.score,
        reason: scored.reason
      })
    );
  }

  duplicateCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  return duplicateCandidates.slice(0, TOP_DUPLICATE_MATCHES);
}
