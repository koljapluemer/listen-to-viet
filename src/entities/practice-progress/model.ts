import type { Model } from "ebisu-js/interfaces";
import * as ebisu from "ebisu-js";
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

export interface PracticeEvent {
  eventType: "roundStarted" | "answer" | "audioListened";
  clip: StoredClip;
  timestamp: string;
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

export interface LearningRecord {
  clip: StoredClip;
  model: Model;
  timestamp: string;
}

export interface PracticeExportSnapshot {
  exported_at: string;
  learning_models: LearningRecord[];
  event_log: PracticeEvent[];
}

export const cloneModel = (model: Model): Model => [...model] as Model;

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

export const cloneLearningRecord = (record: LearningRecord): LearningRecord => ({
  clip: cloneStoredClip(record.clip),
  model: cloneModel(record.model),
  timestamp: record.timestamp,
});

export const getRecallProbability = (
  record: Pick<LearningRecord, "model" | "timestamp">,
  now = Date.now()
) =>
  ebisu.predictRecall(
    record.model,
    Math.floor((now - new Date(record.timestamp).getTime()) / 1000),
    true
  );

export const getWeakestLearningRecord = <T extends Pick<LearningRecord, "model" | "timestamp">>(
  records: T[],
  now = Date.now()
) => {
  if (!records.length) {
    return null;
  }

  let weakestRecord = records[0];
  let lowestRecall = getRecallProbability(weakestRecord, now);

  for (const record of records.slice(1)) {
    const recall = getRecallProbability(record, now);

    if (recall < lowestRecall) {
      weakestRecord = record;
      lowestRecall = recall;
    }
  }

  return {
    record: weakestRecord,
    recall: lowestRecall,
  };
};

export const createUpdatedLearningRecord = (
  existingRecord: LearningRecord | null,
  clip: StoredClip,
  isCorrect: boolean,
  now = new Date()
): LearningRecord => {
  const timestamp = now.toISOString();

  if (!existingRecord) {
    return {
      clip: cloneStoredClip(clip),
      model: cloneModel(ebisu.defaultModel(isCorrect ? 60 : 5)),
      timestamp,
    };
  }

  const elapsedTime = Math.max(
    1,
    Math.floor((now.getTime() - new Date(existingRecord.timestamp).getTime()) / 1000)
  );

  return {
    clip: cloneStoredClip(clip),
    model: cloneModel(
      ebisu.updateRecall(existingRecord.model, isCorrect ? 0.95 : 0.05, 1, elapsedTime)
    ),
    timestamp,
  };
};
