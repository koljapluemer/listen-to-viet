import type { Clip, DistractorCandidate } from "../../entities/listening-clip/model";
import type { PracticeSelectionMetaMode } from "../../entities/practice-progress/model";
import type { PracticePairTarget } from "../../entities/practice-progress/stats";

export interface AnswerOption {
  label: string;
  isCorrect: boolean;
}

export interface PracticeSessionConfig {
  pairFilter?: PracticePairTarget;
  metaMode: Extract<PracticeSelectionMetaMode, "default" | "fixedPairBidirectional">;
  metaPair?: PracticePairTarget;
}

export interface PracticeCatalogEntry {
  clip: Clip;
  candidates: DistractorCandidate[];
}

export interface PracticePairOption {
  kind: PracticePairTarget["kind"];
  leftKey: string;
  rightKey: string;
  label: string;
  pairTarget: PracticePairTarget;
}
