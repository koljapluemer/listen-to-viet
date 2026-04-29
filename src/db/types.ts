import type { Model } from "ebisu-js/interfaces";

export interface DbStoredClip {
  filename: string;
  transcript: string;
}

export interface DbPracticeEventRow {
  id?: number;
  eventType: "roundStarted" | "answer";
  clip: DbStoredClip;
  timestamp: string;
  distractor?: string;
  duration_ms?: number | null;
  selectedTranscript?: string;
  isCorrect?: boolean;
}

export interface DbLearningRecordRow {
  clipFilename: string;
  clip: DbStoredClip;
  model: Model;
  timestamp: string;
}
