import { appDb } from "../../db/appDb";
import type { DbPracticeEventRow } from "../../db/types";
import {
  clonePracticeEvent,
  cloneStoredClip,
  type PracticeEvent,
  type PracticeExportSnapshot,
} from "./model";

interface ImportPracticeExportResult {
  importedCount: number;
  skippedCount: number;
}

const toPracticeEventRow = (event: PracticeEvent): DbPracticeEventRow => ({
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

const fromPracticeEventRow = (row: DbPracticeEventRow): PracticeEvent => ({
  eventType: row.eventType,
  clip: cloneStoredClip(row.clip),
  timestamp: row.timestamp,
  selectionMode: row.selectionMode,
  metaMode: row.metaMode,
  metaBlockIndex: row.metaBlockIndex,
  metaPairKind: row.metaPairKind,
  metaPairLeftKey: row.metaPairLeftKey,
  metaPairRightKey: row.metaPairRightKey,
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

const PRACTICE_EVENT_TYPES = new Set(["roundStarted", "answer", "audioListened"]);
const SELECTION_MODES = new Set(["strategyA", "strategyB", "random", "learningPrediction"]);
const META_MODES = new Set(["default", "weakestPairBidirectional"]);
const CONFUSION_KINDS = new Set(["letter", "tone"]);
const LETTER_KEYS = new Set(["a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y", "d", "đ"]);
const TONE_KEYS = new Set(["ngang", "huyen", "sac", "hoi", "nga", "nang"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readOptionalString = (value: unknown, field: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid ${field}.`);
  }

  return value;
};

const readOptionalNumber = (value: unknown, field: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return value;
};

const readOptionalBoolean = (value: unknown, field: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${field}.`);
  }

  return value;
};

const readOptionalStringLiteral = <T extends string | undefined>(
  value: unknown,
  allowedValues: Set<string>,
  field: string
) => {
  if (value === undefined) {
    return undefined as T | undefined;
  }

  if (typeof value !== "string" || !allowedValues.has(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return value as T;
};

const readOptionalNullableStringLiteral = <T extends string | null | undefined>(
  value: unknown,
  allowedValues: Set<string>,
  field: string
) => {
  if (value === undefined) {
    return undefined as T | null | undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !allowedValues.has(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return value as T;
};

const comparePracticeEventRows = (left: DbPracticeEventRow, right: DbPracticeEventRow) => {
  const timestampComparison = left.timestamp.localeCompare(right.timestamp);

  if (timestampComparison !== 0) {
    return timestampComparison;
  }

  return (left.id ?? 0) - (right.id ?? 0);
};

const parsePracticeEvent = (value: unknown): PracticeEvent => {
  if (!isObject(value)) {
    throw new Error("Invalid event_log entry.");
  }

  const clip = value.clip;

  if (!isObject(clip) || typeof clip.filename !== "string" || typeof clip.transcript !== "string") {
    throw new Error("Invalid event clip.");
  }

  if (typeof value.timestamp !== "string") {
    throw new Error("Invalid event timestamp.");
  }

  if (typeof value.eventType !== "string" || !PRACTICE_EVENT_TYPES.has(value.eventType)) {
    throw new Error("Invalid event type.");
  }

  return {
    eventType: value.eventType as PracticeEvent["eventType"],
    clip: {
      filename: clip.filename,
      transcript: clip.transcript,
    },
    timestamp: value.timestamp,
    selectionMode: readOptionalStringLiteral<PracticeEvent["selectionMode"]>(
      value.selectionMode,
      SELECTION_MODES,
      "selectionMode"
    ),
    metaMode: readOptionalStringLiteral<PracticeEvent["metaMode"]>(value.metaMode, META_MODES, "metaMode"),
    metaBlockIndex: readOptionalNumber(value.metaBlockIndex, "metaBlockIndex"),
    metaPairKind: readOptionalStringLiteral<PracticeEvent["metaPairKind"]>(
      value.metaPairKind,
      CONFUSION_KINDS,
      "metaPairKind"
    ),
    metaPairLeftKey: readOptionalString(value.metaPairLeftKey, "metaPairLeftKey"),
    metaPairRightKey: readOptionalString(value.metaPairRightKey, "metaPairRightKey"),
    distractor: readOptionalString(value.distractor, "distractor"),
    duration_ms: value.duration_ms === null ? null : readOptionalNumber(value.duration_ms, "duration_ms"),
    selectedTranscript: readOptionalString(value.selectedTranscript, "selectedTranscript"),
    isCorrect: readOptionalBoolean(value.isCorrect, "isCorrect"),
    analyticsVersion:
      value.analyticsVersion === undefined
        ? undefined
        : value.analyticsVersion === 1
          ? 1
          : (() => {
              throw new Error("Invalid analyticsVersion.");
            })(),
    changedIndex: readOptionalNumber(value.changedIndex, "changedIndex"),
    confusionKind: readOptionalStringLiteral<PracticeEvent["confusionKind"]>(
      value.confusionKind,
      CONFUSION_KINDS,
      "confusionKind"
    ),
    correctCharacter: readOptionalString(value.correctCharacter, "correctCharacter"),
    distractorCharacter: readOptionalString(value.distractorCharacter, "distractorCharacter"),
    correctLetter: readOptionalStringLiteral<PracticeEvent["correctLetter"]>(
      value.correctLetter,
      LETTER_KEYS,
      "correctLetter"
    ),
    distractorLetter: readOptionalStringLiteral<PracticeEvent["distractorLetter"]>(
      value.distractorLetter,
      LETTER_KEYS,
      "distractorLetter"
    ),
    correctTone: readOptionalNullableStringLiteral<PracticeEvent["correctTone"]>(
      value.correctTone,
      TONE_KEYS,
      "correctTone"
    ),
    distractorTone: readOptionalNullableStringLiteral<PracticeEvent["distractorTone"]>(
      value.distractorTone,
      TONE_KEYS,
      "distractorTone"
    ),
  };
};

export const appendPracticeEvent = async (event: PracticeEvent) => {
  await appDb.practiceEvents.add(toPracticeEventRow(clonePracticeEvent(event)));
};

export const listPracticeEvents = async () => {
  const rows = await appDb.practiceEvents.toArray();
  rows.sort(comparePracticeEventRows);
  return rows.map((row) => fromPracticeEventRow(row));
};

export const rewritePracticeEvents = async (
  rewriteEvent: (event: PracticeEvent) => PracticeEvent
) => {
  const rows = await appDb.practiceEvents.toArray();
  rows.sort(comparePracticeEventRows);

  const rewrittenRows: DbPracticeEventRow[] = [];
  const rewrittenEvents: PracticeEvent[] = [];

  rows.forEach((row) => {
    const nextEvent = clonePracticeEvent(rewriteEvent(fromPracticeEventRow(row)));
    rewrittenEvents.push(nextEvent);

    const nextRow = {
      ...toPracticeEventRow(nextEvent),
      id: row.id,
    } satisfies DbPracticeEventRow;

    const previousRowSnapshot = JSON.stringify({
      ...row,
      id: undefined,
    });
    const nextRowSnapshot = JSON.stringify({
      ...nextRow,
      id: undefined,
    });

    if (previousRowSnapshot !== nextRowSnapshot) {
      rewrittenRows.push(nextRow);
    }
  });

  if (rewrittenRows.length) {
    await appDb.practiceEvents.bulkPut(rewrittenRows);
  }

  return rewrittenEvents;
};

export const readPracticeExportSnapshot = async (): Promise<PracticeExportSnapshot> => {
  const practiceEvents = await listPracticeEvents();

  return {
    exported_at: new Date().toISOString(),
    event_log: practiceEvents.map((event) => clonePracticeEvent(event)),
  };
};

export const importPracticeExportSnapshot = async (
  snapshot: unknown
): Promise<ImportPracticeExportResult> => {
  if (!isObject(snapshot) || !Array.isArray(snapshot.event_log)) {
    throw new Error("Invalid tracked data file.");
  }

  const importedEvents = snapshot.event_log.map((event) => parsePracticeEvent(event));
  importedEvents.sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return appDb.transaction("rw", appDb.practiceEvents, async () => {
    const existingRows = await appDb.practiceEvents.toArray();
    const seenTimestamps = new Set(existingRows.map((row) => row.timestamp));
    const rowsToAdd: DbPracticeEventRow[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (const event of importedEvents) {
      if (seenTimestamps.has(event.timestamp)) {
        skippedCount += 1;
        continue;
      }

      rowsToAdd.push(toPracticeEventRow(clonePracticeEvent(event)));
      seenTimestamps.add(event.timestamp);
      importedCount += 1;
    }

    if (rowsToAdd.length) {
      await appDb.practiceEvents.bulkAdd(rowsToAdd);
    }

    return {
      importedCount,
      skippedCount,
    };
  });
};
