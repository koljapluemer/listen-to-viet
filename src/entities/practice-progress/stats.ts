import type {
  ConfusionKind,
  DistractorCandidate,
} from "../listening-clip/model";
import { LETTER_KEYS, TONE_KEYS } from "../listening-clip/model";
import type { PracticeEvent } from "./model";

const BETA_PRIOR_ALPHA = 2;
const BETA_PRIOR_BETA = 1;
const RECENT_KIND_WINDOW = 40;
const KIND_BALANCE_THRESHOLD = 4;
const TOP_PAIR_MIN_ATTEMPTS = 3;

export interface MatrixCellStats {
  correctKey: string;
  distractorKey: string;
  attempts: number;
  correct: number;
  posteriorAccuracy: number | null;
  rawAccuracy: number | null;
}

export interface MatrixRowStats {
  key: string;
  cells: MatrixCellStats[];
}

export interface MatrixTopPair {
  label: string;
  attempts: number;
  correct: number;
  posteriorAccuracy: number;
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
  letter: MatrixSummary;
  tone: MatrixSummary;
}

export interface AccuracyTrialPoint {
  trialNumber: number;
  isCorrect: boolean;
  rolling10: number;
  rolling100: number;
}

interface PairCounts {
  attempts: number;
  correct: number;
}

interface TrackedAnswerEvent extends PracticeEvent {
  eventType: "answer";
  analyticsVersion: 1;
  confusionKind: ConfusionKind;
  isCorrect: boolean;
}

export const calculatePosteriorAccuracy = (correct: number, attempts: number) =>
  (correct + BETA_PRIOR_ALPHA) / (attempts + BETA_PRIOR_ALPHA + BETA_PRIOR_BETA);

const getPairKey = (kind: ConfusionKind, correctKey: string, distractorKey: string) =>
  `${kind}:${correctKey}->${distractorKey}`;

const getTrackedAnswerEvents = (events: PracticeEvent[]) =>
  events.filter(
    (event): event is TrackedAnswerEvent =>
      event.eventType === "answer" &&
      event.analyticsVersion === 1 &&
      typeof event.isCorrect === "boolean" &&
      !!event.confusionKind
  );

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

    const pairKey = getPairKey(kind, correctKey, distractorKey);
    const current = counts.get(pairKey) ?? { attempts: 0, correct: 0 };
    counts.set(pairKey, {
      attempts: current.attempts + 1,
      correct: current.correct + (event.isCorrect ? 1 : 0),
    });
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
        } satisfies MatrixCellStats;
      }

      attempts += pair.attempts;
      correct += pair.correct;
      distinctPairs += 1;

      return {
        correctKey,
        distractorKey,
        attempts: pair.attempts,
        correct: pair.correct,
        posteriorAccuracy: calculatePosteriorAccuracy(pair.correct, pair.attempts),
        rawAccuracy: pair.correct / pair.attempts,
      } satisfies MatrixCellStats;
    }),
  }));

  const topPairs = rows
    .flatMap((row) =>
      row.cells
        .filter(
          (cell) =>
            cell.posteriorAccuracy !== null &&
            cell.attempts >= TOP_PAIR_MIN_ATTEMPTS &&
            cell.correctKey !== cell.distractorKey
        )
        .map((cell) => ({
          label: `${cell.correctKey} -> ${cell.distractorKey}`,
          attempts: cell.attempts,
          correct: cell.correct,
          posteriorAccuracy: cell.posteriorAccuracy!,
        }))
    )
    .sort((left, right) => {
      if (left.posteriorAccuracy !== right.posteriorAccuracy) {
        return left.posteriorAccuracy - right.posteriorAccuracy;
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

    const pairKey = getPairKey(event.confusionKind, correctKey, distractorKey);
    const current = counts.get(pairKey) ?? { attempts: 0, correct: 0 };
    counts.set(pairKey, {
      attempts: current.attempts + 1,
      correct: current.correct + (event.isCorrect ? 1 : 0),
    });
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
  const correct = counts?.correct ?? 0;
  const posteriorAccuracy = attempts ? calculatePosteriorAccuracy(correct, attempts) : null;

  let score = 0;

  if (attempts === 0) {
    score += 100;
  } else if (posteriorAccuracy !== null) {
    score += (1 - posteriorAccuracy) * 20;
  }

  if (targetKind === candidate.kind) {
    score += 15;
  }

  score += Math.random();
  return score;
};

export const getPracticeStatsSnapshot = (events: PracticeEvent[]): PracticeStatsSnapshot => {
  const trackedEvents = getTrackedAnswerEvents(events);

  return {
    letter: toMatrixSummary("letter", LETTER_KEYS, buildPairCounts(trackedEvents, "letter")),
    tone: toMatrixSummary("tone", TONE_KEYS, buildPairCounts(trackedEvents, "tone")),
  };
};

export const getAccuracyTrialSeries = (events: PracticeEvent[], visibleWindow = 100) => {
  const answerEvents = events.filter(
    (event): event is PracticeEvent & { eventType: "answer"; isCorrect: boolean } =>
      event.eventType === "answer" && typeof event.isCorrect === "boolean"
  );
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
