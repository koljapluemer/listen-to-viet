import type { Model } from "ebisu-js/interfaces";

type DbConfusionKind = "letter" | "tone";
type DbLetterKey = "a" | "ă" | "â" | "e" | "ê" | "i" | "o" | "ô" | "ơ" | "u" | "ư" | "y" | "d" | "đ";
type DbToneKey = "ngang" | "huyen" | "sac" | "hoi" | "nga" | "nang";

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
  analyticsVersion?: 1;
  changedIndex?: number;
  confusionKind?: DbConfusionKind;
  correctCharacter?: string;
  distractorCharacter?: string;
  correctLetter?: DbLetterKey;
  distractorLetter?: DbLetterKey;
  correctTone?: DbToneKey | null;
  distractorTone?: DbToneKey | null;
}

export interface DbLearningRecordRow {
  clipFilename: string;
  clip: DbStoredClip;
  model: Model;
  timestamp: string;
}
