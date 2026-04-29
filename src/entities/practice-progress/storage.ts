import { appDb } from "../../db/appDb";
import type { DbLearningRecordRow, DbPracticeEventRow } from "../../db/types";
import {
  cloneLearningRecord,
  cloneModel,
  clonePracticeEvent,
  cloneStoredClip,
  type LearningRecord,
  type PracticeEvent,
  type PracticeExportSnapshot,
} from "./model";

const toPracticeEventRow = (event: PracticeEvent): DbPracticeEventRow => ({
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

const fromPracticeEventRow = (row: DbPracticeEventRow): PracticeEvent => ({
  eventType: row.eventType,
  clip: cloneStoredClip(row.clip),
  timestamp: row.timestamp,
  distractor: row.distractor,
  duration_ms: row.duration_ms,
  selectedTranscript: row.selectedTranscript,
  isCorrect: row.isCorrect,
  analyticsVersion: row.analyticsVersion,
  changedIndex: row.changedIndex,
  confusionKind: row.confusionKind,
  correctCharacter: row.correctCharacter,
  distractorCharacter: row.distractorCharacter,
  correctLetter: row.correctLetter,
  distractorLetter: row.distractorLetter,
  correctTone: row.correctTone,
  distractorTone: row.distractorTone,
});

const toLearningRecordRow = (record: LearningRecord): DbLearningRecordRow => ({
  clipFilename: record.clip.filename,
  clip: cloneStoredClip(record.clip),
  model: cloneModel(record.model),
  timestamp: record.timestamp,
});

const fromLearningRecordRow = (row: DbLearningRecordRow): LearningRecord => ({
  clip: cloneStoredClip(row.clip),
  model: cloneModel(row.model),
  timestamp: row.timestamp,
});

export const appendPracticeEvent = async (event: PracticeEvent) => {
  await appDb.practiceEvents.add(toPracticeEventRow(clonePracticeEvent(event)));
};

export const listPracticeEvents = async () => {
  const rows = await appDb.practiceEvents.orderBy("id").toArray();
  return rows.map((row) => fromPracticeEventRow(row));
};

export const saveLearningRecord = async (record: LearningRecord) => {
  await appDb.learningRecords.put(toLearningRecordRow(cloneLearningRecord(record)));
};

export const listLearningRecords = async () => {
  const rows = await appDb.learningRecords.toArray();
  return rows.map((row) => fromLearningRecordRow(row));
};

export const readPracticeExportSnapshot = async (): Promise<PracticeExportSnapshot> => {
  const [learningRecords, practiceEvents] = await Promise.all([
    listLearningRecords(),
    listPracticeEvents(),
  ]);

  return {
    exported_at: new Date().toISOString(),
    learning_models: learningRecords.map((record) => cloneLearningRecord(record)),
    event_log: practiceEvents.map((event) => clonePracticeEvent(event)),
  };
};
