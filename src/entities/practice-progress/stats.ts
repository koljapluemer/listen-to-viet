import type {
  ConfusionKind,
  DistractorCandidate,
} from "../listening-clip/model";
import { LETTER_KEYS, TONE_KEYS } from "../listening-clip/model";
import type { PracticeEvent } from "./model";

const BETA_PRIOR_ALPHA = 2;
const BETA_PRIOR_BETA = 1;
const RECENT_KIND_WINDOW = 40;
const RECENT_PAIR_WINDOW = 10;
const KIND_BALANCE_THRESHOLD = 4;
const TOP_PAIR_MIN_ATTEMPTS = 3;

export interface MatrixCellStats {
  correctKey: string;
  distractorKey: string;
  attempts: number;
  correct: number;
  posteriorAccuracy: number | null;
  rawAccuracy: number | null;
  recentAttempts: number;
  recentCorrect: number;
  recentAccuracy: number | null;
}

export interface MatrixRowStats {
  key: string;
  cells: MatrixCellStats[];
}

export interface MatrixTopPair {
  label: string;
  attempts: number;
  correct: number;
  recentAttempts: number;
  recentCorrect: number;
  recentAccuracy: number;
}

export interface PracticePairTarget {
  kind: ConfusionKind;
  correctKey: string;
  distractorKey: string;
}

export interface MatrixSummary {
  attempts: number;
  correct: number;
  posteriorAccuracy: number | null;
  distinctPairs: number;
  topPairs: MatrixTopPair[];
  rows: MatrixRowStats[];
}

export interface PracticeStatsSnapshot {
  overview: PracticeOverviewStats;
  dailyExercises: DailyExercisePoint[];
  dailyAccuracy: DailyAccuracyPoint[];
  letter: MatrixSummary;
  tone: MatrixSummary;
}

export interface AccuracyTrialPoint {
  trialNumber: number;
  isCorrect: boolean;
  rolling10: number;
  rolling100: number;
  rolling1000: number;
}

export interface PracticeOverviewStats {
  totalExercises: number;
  totalListeningMs: number;
}

export interface DailyExercisePoint {
  day: string;
  exercises: number;
}

export interface DailyAccuracyPoint {
  day: string;
  trials: number;
  correct: number;
  accuracy: number | null;
  confidenceLow95: number | null;
  confidenceHigh95: number | null;
}

interface PairCounts {
  attempts: number;
  correct: number;
  recentResults: boolean[];
}

interface TrackedAnswerEvent extends PracticeEvent {
  eventType: "answer";
  analyticsVersion: 1;
  confusionKind: ConfusionKind;
  isCorrect: boolean;
}

interface AnswerEvent extends PracticeEvent {
  eventType: "answer";
}

interface AccuracyAnswerEvent extends AnswerEvent {
  isCorrect: boolean;
}

interface AudioListenedEvent extends PracticeEvent {
  eventType: "audioListened";
  duration_ms: number;
}

const LOCAL_DAY_PARTS_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const WILSON_Z_95 = 1.959963984540054;

export const calculatePosteriorAccuracy = (correct: number, attempts: number) =>
  (correct + BETA_PRIOR_ALPHA) / (attempts + BETA_PRIOR_ALPHA + BETA_PRIOR_BETA);

const getPairKey = (kind: ConfusionKind, correctKey: string, distractorKey: string) =>
  `${kind}:${correctKey}->${distractorKey}`;

const getRawAccuracy = (correct: number, attempts: number) => (attempts ? correct / attempts : null);

const parsePairKey = (pairKey: string): PracticePairTarget | null => {
  const [kind, keys] = pairKey.split(":");
  const [correctKey, distractorKey] = keys?.split("->") ?? [];

  if (
    (kind !== "letter" && kind !== "tone") ||
    !correctKey ||
    !distractorKey
  ) {
    return null;
  }

  return {
    kind,
    correctKey,
    distractorKey,
  };
};

const getTrackedAnswerEvents = (events: PracticeEvent[]) =>
  events.filter(
    (event): event is TrackedAnswerEvent =>
      event.eventType === "answer" &&
      event.analyticsVersion === 1 &&
      typeof event.isCorrect === "boolean" &&
      !!event.confusionKind
  );

const getAnswerEvents = (events: PracticeEvent[]) =>
  events.filter((event): event is AnswerEvent => event.eventType === "answer");

const getAccuracyAnswerEvents = (events: PracticeEvent[]) =>
  events.filter(
    (event): event is AccuracyAnswerEvent =>
      event.eventType === "answer" && typeof event.isCorrect === "boolean"
  );

const getAudioListenedEvents = (events: PracticeEvent[]) =>
  events.filter(
    (event): event is AudioListenedEvent =>
      event.eventType === "audioListened" &&
      typeof event.duration_ms === "number" &&
      Number.isFinite(event.duration_ms) &&
      event.duration_ms > 0
  );

const getLocalDayKey = (timestamp: string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp.slice(0, 10);
  }

  const parts = LOCAL_DAY_PARTS_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
};

const getDailyExerciseSeries = (events: AnswerEvent[]): DailyExercisePoint[] => {
  const counts = new Map<string, number>();

  events.forEach((event) => {
    const day = getLocalDayKey(event.timestamp);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([day, exercises]) => ({
      day,
      exercises,
    }));
};

const getWilsonConfidenceInterval95 = (correct: number, trials: number) => {
  if (trials <= 0) {
    return {
      high: null,
      low: null,
    };
  }

  const zSquared = WILSON_Z_95 ** 2;
  const proportion = correct / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin =
    (WILSON_Z_95 *
      Math.sqrt((proportion * (1 - proportion)) / trials + zSquared / (4 * trials ** 2))) /
    denominator;

  return {
    high: Math.min(1, center + margin),
    low: Math.max(0, center - margin),
  };
};

const getDailyAccuracySeries = (events: AccuracyAnswerEvent[]): DailyAccuracyPoint[] => {
  const counts = new Map<string, { correct: number; trials: number }>();

  events.forEach((event) => {
    const day = getLocalDayKey(event.timestamp);
    const current = counts.get(day) ?? { correct: 0, trials: 0 };

    counts.set(day, {
      correct: current.correct + (event.isCorrect ? 1 : 0),
      trials: current.trials + 1,
    });
  });

  return [...counts.entries()]
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([day, { correct, trials }]) => {
      const interval = getWilsonConfidenceInterval95(correct, trials);

      return {
        accuracy: trials ? correct / trials : null,
        confidenceHigh95: interval.high,
        confidenceLow95: interval.low,
        correct,
        day,
        trials,
      };
    });
};

const getPracticeOverview = (
  answerEvents: AnswerEvent[],
  audioListenedEvents: AudioListenedEvent[]
): PracticeOverviewStats => ({
  totalExercises: answerEvents.length,
  totalListeningMs: audioListenedEvents.reduce((sum, event) => sum + event.duration_ms, 0),
});

const addPairResult = (counts: Map<string, PairCounts>, pairKey: string, isCorrect: boolean) => {
  const current = counts.get(pairKey) ?? { attempts: 0, correct: 0, recentResults: [] };
  const recentResults = [...current.recentResults, isCorrect].slice(-RECENT_PAIR_WINDOW);

  counts.set(pairKey, {
    attempts: current.attempts + 1,
    correct: current.correct + (isCorrect ? 1 : 0),
    recentResults,
  });
};

const getRecentPairStats = (pair: PairCounts) => {
  const recentAttempts = pair.recentResults.length;
  const recentCorrect = pair.recentResults.filter(Boolean).length;

  return {
    recentAttempts,
    recentCorrect,
    recentAccuracy: getRawAccuracy(recentCorrect, recentAttempts),
  };
};

const buildPairCounts = (events: TrackedAnswerEvent[], kind: ConfusionKind) => {
  const counts = new Map<string, PairCounts>();

  events.forEach((event) => {
    if (event.confusionKind !== kind) {
      return;
    }

    const correctKey = kind === "letter" ? event.correctLetter : event.correctTone;
    const distractorKey = kind === "letter" ? event.distractorLetter : event.distractorTone;

    if (!correctKey || !distractorKey) {
      return;
    }

    addPairResult(counts, getPairKey(kind, correctKey, distractorKey), event.isCorrect);
  });

  return counts;
};

const toMatrixSummary = (
  kind: ConfusionKind,
  keys: readonly string[],
  counts: Map<string, PairCounts>
): MatrixSummary => {
  let attempts = 0;
  let correct = 0;
  let distinctPairs = 0;

  const rows = keys.map((correctKey) => ({
    key: correctKey,
    cells: keys.map((distractorKey) => {
      if (correctKey === distractorKey) {
        return {
          correctKey,
          distractorKey,
          attempts: 0,
          correct: 0,
          posteriorAccuracy: null,
          rawAccuracy: null,
          recentAttempts: 0,
          recentCorrect: 0,
          recentAccuracy: null,
        } satisfies MatrixCellStats;
      }

      const pair = counts.get(getPairKey(kind, correctKey, distractorKey));

      if (!pair) {
        return {
          correctKey,
          distractorKey,
          attempts: 0,
          correct: 0,
          posteriorAccuracy: null,
          rawAccuracy: null,
          recentAttempts: 0,
          recentCorrect: 0,
          recentAccuracy: null,
        } satisfies MatrixCellStats;
      }

      attempts += pair.attempts;
      correct += pair.correct;
      distinctPairs += 1;
      const recentStats = getRecentPairStats(pair);

      return {
        correctKey,
        distractorKey,
        attempts: pair.attempts,
        correct: pair.correct,
        posteriorAccuracy: calculatePosteriorAccuracy(pair.correct, pair.attempts),
        rawAccuracy: getRawAccuracy(pair.correct, pair.attempts),
        recentAttempts: recentStats.recentAttempts,
        recentCorrect: recentStats.recentCorrect,
        recentAccuracy: recentStats.recentAccuracy,
      } satisfies MatrixCellStats;
    }),
  }));

  const topPairs = rows
    .flatMap((row) =>
      row.cells
        .filter(
          (cell) =>
            cell.recentAccuracy !== null &&
            cell.attempts >= TOP_PAIR_MIN_ATTEMPTS &&
            cell.correctKey !== cell.distractorKey
        )
        .map((cell) => ({
          label: `${cell.correctKey} -> ${cell.distractorKey}`,
          attempts: cell.attempts,
          correct: cell.correct,
          recentAttempts: cell.recentAttempts,
          recentCorrect: cell.recentCorrect,
          recentAccuracy: cell.recentAccuracy!,
        }))
    )
    .sort((left, right) => {
      if (left.recentAccuracy !== right.recentAccuracy) {
        return left.recentAccuracy - right.recentAccuracy;
      }

      if (left.recentAttempts !== right.recentAttempts) {
        return right.recentAttempts - left.recentAttempts;
      }

      return right.attempts - left.attempts;
    })
    .slice(0, 5);

  return {
    attempts,
    correct,
    posteriorAccuracy: attempts ? calculatePosteriorAccuracy(correct, attempts) : null,
    distinctPairs,
    topPairs,
    rows,
  };
};

const getCandidatePairCounts = (events: TrackedAnswerEvent[]) => {
  const counts = new Map<string, PairCounts>();

  events.forEach((event) => {
    const correctKey =
      event.confusionKind === "letter" ? event.correctLetter : event.correctTone;
    const distractorKey =
      event.confusionKind === "letter" ? event.distractorLetter : event.distractorTone;

    if (!correctKey || !distractorKey) {
      return;
    }

    addPairResult(counts, getPairKey(event.confusionKind, correctKey, distractorKey), event.isCorrect);
  });

  return counts;
};

const getTargetKind = (events: TrackedAnswerEvent[]): ConfusionKind | null => {
  const recentEvents = events.slice(-RECENT_KIND_WINDOW);
  const letterAttempts = recentEvents.filter((event) => event.confusionKind === "letter").length;
  const toneAttempts = recentEvents.filter((event) => event.confusionKind === "tone").length;

  if (Math.abs(letterAttempts - toneAttempts) < KIND_BALANCE_THRESHOLD) {
    return null;
  }

  return letterAttempts < toneAttempts ? "letter" : "tone";
};

const getCandidateScore = (
  candidate: DistractorCandidate,
  pairCounts: Map<string, PairCounts>,
  targetKind: ConfusionKind | null
) => {
  const pairKey =
    candidate.kind === "letter"
      ? getPairKey(candidate.kind, candidate.correctLetter, candidate.distractorLetter)
      : getPairKey(candidate.kind, candidate.correctTone!, candidate.distractorTone!);
  const counts = pairCounts.get(pairKey);
  const attempts = counts?.attempts ?? 0;
  const recentStats = counts ? getRecentPairStats(counts) : null;

  let score = 0;

  if (attempts === 0) {
    score += 100;
  } else if (recentStats && recentStats.recentAccuracy !== null) {
    score += (1 - recentStats.recentAccuracy) * 20;
  }

  if (targetKind === candidate.kind) {
    score += 15;
  }

  score += Math.random();
  return score;
};

export const getPracticeStatsSnapshot = (events: PracticeEvent[]): PracticeStatsSnapshot => {
  const answerEvents = getAnswerEvents(events);
  const accuracyAnswerEvents = getAccuracyAnswerEvents(events);
  const trackedEvents = getTrackedAnswerEvents(events);
  const audioListenedEvents = getAudioListenedEvents(events);

  return {
    overview: getPracticeOverview(answerEvents, audioListenedEvents),
    dailyAccuracy: getDailyAccuracySeries(accuracyAnswerEvents),
    dailyExercises: getDailyExerciseSeries(answerEvents),
    letter: toMatrixSummary("letter", LETTER_KEYS, buildPairCounts(trackedEvents, "letter")),
    tone: toMatrixSummary("tone", TONE_KEYS, buildPairCounts(trackedEvents, "tone")),
  };
};

export const getAccuracyTrialSeries = (events: PracticeEvent[], visibleWindow?: number) => {
  const answerEvents = getAccuracyAnswerEvents(events);
  const trials: AccuracyTrialPoint[] = [];
  let rolling10Correct = 0;
  let rolling100Correct = 0;
  let rolling1000Correct = 0;

  answerEvents.forEach((event, index) => {
    const value = event.isCorrect ? 1 : 0;
    rolling10Correct += value;
    rolling100Correct += value;
    rolling1000Correct += value;

    if (index >= 10) {
      rolling10Correct -= answerEvents[index - 10].isCorrect ? 1 : 0;
    }

    if (index >= 100) {
      rolling100Correct -= answerEvents[index - 100].isCorrect ? 1 : 0;
    }

    if (index >= 1000) {
      rolling1000Correct -= answerEvents[index - 1000].isCorrect ? 1 : 0;
    }

    trials.push({
      trialNumber: index + 1,
      isCorrect: event.isCorrect,
      rolling10: rolling10Correct / Math.min(index + 1, 10),
      rolling100: rolling100Correct / Math.min(index + 1, 100),
      rolling1000: rolling1000Correct / Math.min(index + 1, 1000),
    });
  });

  return typeof visibleWindow === "number" ? trials.slice(-visibleWindow) : trials;
};

export const chooseDistractorCandidate = (
  candidates: DistractorCandidate[],
  events: PracticeEvent[]
) => {
  if (!candidates.length) {
    return null;
  }

  const trackedEvents = getTrackedAnswerEvents(events);
  const pairCounts = getCandidatePairCounts(trackedEvents);
  const targetKind = getTargetKind(trackedEvents);

  return candidates
    .map((candidate) => ({
      candidate,
      score: getCandidateScore(candidate, pairCounts, targetKind),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate ?? null;
};

export const getWeakestRecentPairTarget = (events: PracticeEvent[]) => {
  const trackedEvents = getTrackedAnswerEvents(events);
  const pairCounts = getCandidatePairCounts(trackedEvents);
  let weakestPair: (PracticePairTarget & {
    recentAccuracy: number;
    recentAttempts: number;
    attempts: number;
  }) | null = null;

  for (const [pairKey, pair] of pairCounts.entries()) {
    const target = parsePairKey(pairKey);
    const recentStats = getRecentPairStats(pair);

    if (!target || recentStats.recentAccuracy === null) {
      continue;
    }

    const candidate: PracticePairTarget & {
      recentAccuracy: number;
      recentAttempts: number;
      attempts: number;
    } = {
      ...target,
      recentAccuracy: recentStats.recentAccuracy,
      recentAttempts: recentStats.recentAttempts,
      attempts: pair.attempts,
    };

    if (
      !weakestPair ||
      candidate.recentAccuracy < weakestPair.recentAccuracy ||
      (candidate.recentAccuracy === weakestPair.recentAccuracy &&
        candidate.recentAttempts > weakestPair.recentAttempts) ||
      (candidate.recentAccuracy === weakestPair.recentAccuracy &&
        candidate.recentAttempts === weakestPair.recentAttempts &&
        candidate.attempts > weakestPair.attempts)
    ) {
      weakestPair = candidate;
    }
  }

  if (!weakestPair) {
    return null;
  }

  return {
    kind: weakestPair.kind,
    correctKey: weakestPair.correctKey,
    distractorKey: weakestPair.distractorKey,
  };
};
