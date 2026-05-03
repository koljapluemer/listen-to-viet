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
  letter: MatrixSummary;
  tone: MatrixSummary;
}

export interface AccuracyTrialPoint {
  trialNumber: number;
  isCorrect: boolean;
  rolling10: number;
  rolling100: number;
}

export interface PracticeOverviewStats {
  totalExercises: number;
  totalListeningMs: number;
}

export interface DailyExercisePoint {
  day: string;
  exercises: number;
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

export const calculatePosteriorAccuracy = (correct: number, attempts: number) =>
  (correct + BETA_PRIOR_ALPHA) / (attempts + BETA_PRIOR_ALPHA + BETA_PRIOR_BETA);

const getPairKey = (kind: ConfusionKind, correctKey: string, distractorKey: string) =>
  `${kind}:${correctKey}->${distractorKey}`;

const getRawAccuracy = (correct: number, attempts: number) => (attempts ? correct / attempts : null);

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
  const trackedEvents = getTrackedAnswerEvents(events);
  const audioListenedEvents = getAudioListenedEvents(events);

  return {
    overview: getPracticeOverview(answerEvents, audioListenedEvents),
    dailyExercises: getDailyExerciseSeries(answerEvents),
    letter: toMatrixSummary("letter", LETTER_KEYS, buildPairCounts(trackedEvents, "letter")),
    tone: toMatrixSummary("tone", TONE_KEYS, buildPairCounts(trackedEvents, "tone")),
  };
};

export const getAccuracyTrialSeries = (events: PracticeEvent[], visibleWindow = 100) => {
  const answerEvents = getAccuracyAnswerEvents(events);
  const trials: AccuracyTrialPoint[] = [];
  let rolling10Correct = 0;
  let rolling100Correct = 0;

  answerEvents.forEach((event, index) => {
    const value = event.isCorrect ? 1 : 0;
    rolling10Correct += value;
    rolling100Correct += value;

    if (index >= 10) {
      rolling10Correct -= answerEvents[index - 10].isCorrect ? 1 : 0;
    }

    if (index >= 100) {
      rolling100Correct -= answerEvents[index - 100].isCorrect ? 1 : 0;
    }

    trials.push({
      trialNumber: index + 1,
      isCorrect: event.isCorrect,
      rolling10: rolling10Correct / Math.min(index + 1, 10),
      rolling100: rolling100Correct / Math.min(index + 1, 100),
    });
  });

  return trials.slice(-visibleWindow);
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
