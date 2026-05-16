type DbConfusionKind = "letter" | "tone";
type DbLetterKey = "a" | "ă" | "â" | "e" | "ê" | "i" | "o" | "ô" | "ơ" | "u" | "ư" | "y" | "d" | "đ";
type DbToneKey = "ngang" | "huyen" | "sac" | "hoi" | "nga" | "nang";
type DbPracticeRoundSelectionMode = "strategyA" | "strategyB" | "random" | "learningPrediction";
type DbPracticeSelectionMetaMode = "default" | "weakestPairBidirectional" | "fixedPairBidirectional";

export interface DbStoredClip {
  filename: string;
  transcript: string;
}

export interface DbPracticeEventRow {
  id?: number;
  eventType: "roundStarted" | "answer" | "audioListened";
  clip: DbStoredClip;
  timestamp: string;
  selectionMode?: DbPracticeRoundSelectionMode;
  metaMode?: DbPracticeSelectionMetaMode;
  metaBlockIndex?: number;
  metaPairKind?: DbConfusionKind;
  metaPairLeftKey?: string;
  metaPairRightKey?: string;
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
