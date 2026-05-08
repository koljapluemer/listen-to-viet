import type {
  Clip,
  ConfusionKind,
  DistractorCandidate,
  LetterKey,
  ToneKey,
} from "../listening-clip/model";

export interface StoredClip {
  filename: string;
  transcript: string;
}

export type PracticeRoundSelectionMode =
  | "strategyA"
  | "strategyB"
  | "random"
  | "learningPrediction";
export type PracticeSelectionMetaMode = "default" | "weakestPairBidirectional";

export interface PracticeEvent {
  eventType: "roundStarted" | "answer" | "audioListened";
  clip: StoredClip;
  timestamp: string;
  selectionMode?: PracticeRoundSelectionMode;
  metaMode?: PracticeSelectionMetaMode;
  metaBlockIndex?: number;
  metaPairKind?: ConfusionKind;
  metaPairLeftKey?: string;
  metaPairRightKey?: string;
  distractor?: string;
  duration_ms?: number | null;
  selectedTranscript?: string;
  isCorrect?: boolean;
  analyticsVersion?: 1;
  changedIndex?: number;
  confusionKind?: ConfusionKind;
  correctCharacter?: string;
  distractorCharacter?: string;
  correctLetter?: LetterKey;
  distractorLetter?: LetterKey;
  correctTone?: ToneKey | null;
  distractorTone?: ToneKey | null;
}

export interface PracticeExportSnapshot {
  exported_at: string;
  event_log: PracticeEvent[];
}

export const toStoredClip = (clip: Pick<Clip, "filename" | "transcript">): StoredClip => ({
  filename: clip.filename,
  transcript: clip.transcript,
});

export const cloneStoredClip = (clip: StoredClip): StoredClip => ({
  filename: clip.filename,
  transcript: clip.transcript,
});

export const toPracticeEventAnalytics = (candidate: DistractorCandidate) => ({
  analyticsVersion: 1 as const,
  changedIndex: candidate.changedIndex,
  confusionKind: candidate.kind,
  correctCharacter: candidate.correctCharacter,
  distractorCharacter: candidate.distractorCharacter,
  correctLetter: candidate.correctLetter,
  distractorLetter: candidate.distractorLetter,
  correctTone: candidate.correctTone,
  distractorTone: candidate.distractorTone,
});

export const clonePracticeEvent = (event: PracticeEvent): PracticeEvent => ({
  eventType: event.eventType,
  clip: cloneStoredClip(event.clip),
  timestamp: event.timestamp,
  selectionMode: event.selectionMode,
  metaMode: event.metaMode,
  metaBlockIndex: event.metaBlockIndex,
  metaPairKind: event.metaPairKind,
  metaPairLeftKey: event.metaPairLeftKey,
  metaPairRightKey: event.metaPairRightKey,
  distractor: event.distractor,
  duration_ms: event.duration_ms,
  selectedTranscript: event.selectedTranscript,
  isCorrect: event.isCorrect,
  analyticsVersion: event.analyticsVersion,
  changedIndex: event.changedIndex,
  confusionKind: event.confusionKind,
  correctCharacter: event.correctCharacter,
  distractorCharacter: event.distractorCharacter,
  correctLetter: event.correctLetter,
  distractorLetter: event.distractorLetter,
  correctTone: event.correctTone,
  distractorTone: event.distractorTone,
});
