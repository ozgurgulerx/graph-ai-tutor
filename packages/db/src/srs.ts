export type ReviewGrade = "wrong" | "partial" | "correct";

export type ReviewScheduleState = {
  ease: number;
  interval: number; // days
  reps: number;
};

export type ReviewScheduleUpdate = ReviewScheduleState & {
  dueAt: number;
};

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const DEFAULT_INTERVAL = 0;
export const DEFAULT_REPS = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeState(state: Partial<ReviewScheduleState>): ReviewScheduleState {
  const ease =
    typeof state.ease === "number" && Number.isFinite(state.ease) ? state.ease : DEFAULT_EASE;
  const interval =
    typeof state.interval === "number" && Number.isFinite(state.interval) ? state.interval : 0;
  const reps = typeof state.reps === "number" && Number.isFinite(state.reps) ? state.reps : 0;

  return {
    ease: Math.max(MIN_EASE, ease),
    interval: Math.max(0, Math.trunc(interval)),
    reps: Math.max(0, Math.trunc(reps))
  };
}

function gradeToQuality(grade: ReviewGrade): number {
  switch (grade) {
    case "wrong":
      return 2;
    case "partial":
      return 3;
    case "correct":
      return 5;
  }
}

function updateEase(ease: number, quality: number): number {
  // SM-2 EF update: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  const diff = 5 - quality;
  const next = ease + (0.1 - diff * (0.08 + diff * 0.02));
  return Math.max(MIN_EASE, next);
}

export function sm2NextSchedule(
  prevState: Partial<ReviewScheduleState>,
  grade: ReviewGrade,
  now: number
): ReviewScheduleUpdate {
  const prev = normalizeState(prevState);
  const quality = gradeToQuality(grade);
  const ease = updateEase(prev.ease, quality);

  if (quality < 3) {
    const interval = 1;
    return {
      ease,
      interval,
      reps: 0,
      dueAt: now + interval * DAY_MS
    };
  }

  const reps = prev.reps + 1;
  const interval =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.max(1, Math.round(prev.interval * ease));

  return {
    ease,
    interval,
    reps,
    dueAt: now + interval * DAY_MS
  };
}

export function updateMasteryScore(prev: number, grade: ReviewGrade, alpha = 0.2): number {
  const target = grade === "correct" ? 1 : grade === "partial" ? 0.6 : 0;
  const current = Number.isFinite(prev) ? prev : 0;
  return clamp01(current + alpha * (target - current));
}

