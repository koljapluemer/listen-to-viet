import {
  type Clip,
  listDistractorCandidates,
  parseTranscriptFile,
} from "../../entities/listening-clip/model";
import {
  getBidirectionalPracticePairKey,
  getCandidatePairTarget,
  type PracticePairTarget,
} from "../../entities/practice-progress/stats";
import type { PracticeCatalogEntry, PracticePairOption } from "./model";

const MAX_WORDS = 5;

const sortPairKeys = (leftKey: string, rightKey: string) =>
  leftKey.localeCompare(rightKey) <= 0 ? [leftKey, rightKey] : [rightKey, leftKey];

const toPracticePairOption = (pairTarget: PracticePairTarget): PracticePairOption => {
  const [leftKey, rightKey] = sortPairKeys(pairTarget.correctKey, pairTarget.distractorKey);

  return {
    kind: pairTarget.kind,
    label: `${leftKey} vs ${rightKey}`,
    leftKey,
    pairTarget,
    rightKey,
  };
};

const matchesPairFilter = (pairTarget: PracticePairTarget, pairFilter?: PracticePairTarget) => {
  if (!pairFilter) {
    return true;
  }

  return (
    getBidirectionalPracticePairKey(pairTarget.kind, pairTarget.correctKey, pairTarget.distractorKey) ===
    getBidirectionalPracticePairKey(pairFilter.kind, pairFilter.correctKey, pairFilter.distractorKey)
  );
};

export const parsePracticeClips = (content: string) => parseTranscriptFile(content, MAX_WORDS);

export const buildPracticeCatalog = (clips: Clip[], pairFilter?: PracticePairTarget): PracticeCatalogEntry[] =>
  clips
    .map((clip) => {
      const candidates = listDistractorCandidates(clip.transcript).filter((candidate) => {
        const pairTarget = getCandidatePairTarget(candidate);
        return pairTarget !== null && matchesPairFilter(pairTarget, pairFilter);
      });

      if (!candidates.length) {
        return null;
      }

      return {
        clip,
        candidates,
      } satisfies PracticeCatalogEntry;
    })
    .filter((entry): entry is PracticeCatalogEntry => entry !== null);

export const listAvailablePracticePairs = (clips: Clip[]) => {
  const pairMap = new Map<string, PracticePairTarget>();

  buildPracticeCatalog(clips).forEach((entry) => {
    entry.candidates.forEach((candidate) => {
      const pairTarget = getCandidatePairTarget(candidate);

      if (!pairTarget) {
        return;
      }

      pairMap.set(
        getBidirectionalPracticePairKey(pairTarget.kind, pairTarget.correctKey, pairTarget.distractorKey),
        pairTarget
      );
    });
  });

  const pairOptions = [...pairMap.values()]
    .map((pairTarget) => toPracticePairOption(pairTarget))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    letterPairs: pairOptions.filter((pairOption) => pairOption.kind === "letter"),
    tonePairs: pairOptions.filter((pairOption) => pairOption.kind === "tone"),
  };
};
