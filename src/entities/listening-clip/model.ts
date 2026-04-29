export interface Clip {
  filename: string;
  transcript: string;
  timing: string;
  audioSrc: string;
  wordCount: number;
}

export const LETTER_KEYS = [
  "a",
  "ă",
  "â",
  "e",
  "ê",
  "i",
  "o",
  "ô",
  "ơ",
  "u",
  "ư",
  "y",
  "d",
  "đ",
] as const;

export const TONE_KEYS = ["ngang", "huyen", "sac", "hoi", "nga", "nang"] as const;
export const LETTER_COMPARISON_GROUPS = [
  ["a", "ă", "â"],
  ["e", "ê"],
  ["i", "y"],
  ["o", "ô", "ơ"],
  ["u", "ư"],
  ["d", "đ"],
] as const;

export type LetterKey = (typeof LETTER_KEYS)[number];
export type ToneKey = (typeof TONE_KEYS)[number];
export type ConfusionKind = "letter" | "tone";

export interface DistractorCandidate {
  label: string;
  changedIndex: number;
  correctCharacter: string;
  distractorCharacter: string;
  kind: ConfusionKind;
  correctLetter: LetterKey;
  distractorLetter: LetterKey;
  correctTone: ToneKey | null;
  distractorTone: ToneKey | null;
}

interface CharacterMetadata {
  letter: LetterKey;
  tone: ToneKey | null;
}

const vowelFamilies = [
  ["a", "à", "á", "ả", "ã", "ạ"],
  ["ă", "ằ", "ắ", "ẳ", "ẵ", "ặ"],
  ["â", "ầ", "ấ", "ẩ", "ẫ", "ậ"],
  ["e", "è", "é", "ẻ", "ẽ", "ẹ"],
  ["ê", "ề", "ế", "ể", "ễ", "ệ"],
  ["i", "ì", "í", "ỉ", "ĩ", "ị"],
  ["o", "ò", "ó", "ỏ", "õ", "ọ"],
  ["ô", "ồ", "ố", "ổ", "ỗ", "ộ"],
  ["ơ", "ờ", "ớ", "ở", "ỡ", "ợ"],
  ["u", "ù", "ú", "ủ", "ũ", "ụ"],
  ["ư", "ừ", "ứ", "ử", "ữ", "ự"],
  ["y", "ỳ", "ý", "ỷ", "ỹ", "ỵ"],
] as const satisfies readonly (readonly string[])[];

const consonantFamilies = [["d", "đ"]] as const satisfies readonly (readonly string[])[];

const confusableToneGroups = [
  [vowelFamilies[0], vowelFamilies[1], vowelFamilies[2]],
  [vowelFamilies[3], vowelFamilies[4]],
  [vowelFamilies[5], vowelFamilies[11]],
  [vowelFamilies[6], vowelFamilies[7], vowelFamilies[8]],
  [vowelFamilies[9], vowelFamilies[10]],
] as const;

const transcriptCleanupPattern = /(^|\s)-N(?=\s|$)/g;
const wordSplitPattern = /\s+/;

const characterMetadataMap = (() => {
  const map = new Map<string, CharacterMetadata>();

  for (const family of vowelFamilies) {
    const letter = family[0] as LetterKey;

    family.forEach((character, toneIndex) => {
      map.set(character, {
        letter,
        tone: TONE_KEYS[toneIndex],
      });
    });
  }

  consonantFamilies.forEach((family) => {
    family.forEach((character) => {
      map.set(character, {
        letter: character as LetterKey,
        tone: null,
      });
    });
  });

  for (const [character, metadata] of [...map.entries()]) {
    map.set(character.toUpperCase(), metadata);
  }

  return map;
})();

const alternativeMap = (() => {
  const map = new Map<string, Set<string>>();

  const addAlternative = (source: string, candidate: string) => {
    if (source === candidate) {
      return;
    }

    const alternatives = map.get(source) ?? new Set<string>();
    alternatives.add(candidate);
    map.set(source, alternatives);
  };

  for (const family of vowelFamilies) {
    for (const source of family) {
      for (const candidate of family) {
        addAlternative(source, candidate);
      }
    }
  }

  for (const group of confusableToneGroups) {
    for (let familyIndex = 0; familyIndex < group.length; familyIndex += 1) {
      const family = group[familyIndex];

      for (let toneIndex = 0; toneIndex < family.length; toneIndex += 1) {
        const source = family[toneIndex];

        for (let otherFamilyIndex = 0; otherFamilyIndex < group.length; otherFamilyIndex += 1) {
          if (otherFamilyIndex === familyIndex) {
            continue;
          }

          addAlternative(source, group[otherFamilyIndex][toneIndex]);
        }
      }
    }
  }

  for (const family of consonantFamilies) {
    for (const source of family) {
      for (const candidate of family) {
        addAlternative(source, candidate);
      }
    }
  }

  for (const [source, candidates] of [...map.entries()]) {
    const upperSource = source.toUpperCase();

    for (const candidate of candidates) {
      addAlternative(upperSource, candidate.toUpperCase());
    }
  }

  return new Map<string, string[]>(
    [...map.entries()].map(([source, candidates]) => [source, [...candidates]])
  );
})();

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const getCharacterMetadata = (character: string) => characterMetadataMap.get(character) ?? null;

const getConfusionKind = (
  sourceMetadata: CharacterMetadata,
  candidateMetadata: CharacterMetadata
): ConfusionKind | null => {
  if (sourceMetadata.letter !== candidateMetadata.letter) {
    return "letter";
  }

  if (sourceMetadata.tone !== null && candidateMetadata.tone !== null) {
    return "tone";
  }

  return null;
};

export const normalizeTranscript = (value: string) =>
  value.replace(transcriptCleanupPattern, " ").replace(wordSplitPattern, " ").trim();

export const countWords = (value: string) => {
  const normalized = normalizeTranscript(value);
  return normalized ? normalized.split(" ").length : 0;
};

export const canGenerateDistractor = (transcript: string) =>
  [...normalizeTranscript(transcript)].some((character) => alternativeMap.has(character));

export const listDistractorCandidates = (transcript: string) => {
  const normalizedTranscript = normalizeTranscript(transcript);
  const characters = [...normalizedTranscript];
  const candidates: DistractorCandidate[] = [];

  characters.forEach((character, changedIndex) => {
    const sourceMetadata = getCharacterMetadata(character);
    const alternatives = alternativeMap.get(character);

    if (!sourceMetadata || !alternatives?.length) {
      return;
    }

    alternatives.forEach((alternative) => {
      const candidateMetadata = getCharacterMetadata(alternative);

      if (!candidateMetadata) {
        return;
      }

      const kind = getConfusionKind(sourceMetadata, candidateMetadata);

      if (!kind) {
        return;
      }

      const mutated = [...characters];
      mutated[changedIndex] = alternative;
      const label = mutated.join("");

      if (label === normalizedTranscript) {
        return;
      }

      candidates.push({
        label,
        changedIndex,
        correctCharacter: character,
        distractorCharacter: alternative,
        kind,
        correctLetter: sourceMetadata.letter,
        distractorLetter: candidateMetadata.letter,
        correctTone: sourceMetadata.tone,
        distractorTone: candidateMetadata.tone,
      });
    });
  });

  return shuffle(candidates);
};

export const generateDistractor = (transcript: string) => listDistractorCandidates(transcript)[0]?.label ?? null;

export const parseTranscriptFile = (content: string, maxWords: number) =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [filename, rawTranscript, timing] = line.split("|");

      if (!filename || rawTranscript === undefined || !timing) {
        return null;
      }

      const transcript = normalizeTranscript(rawTranscript);
      const wordCount = countWords(transcript);

      if (!transcript || wordCount > maxWords || !canGenerateDistractor(transcript)) {
        return null;
      }

      return {
        filename,
        transcript,
        timing,
        audioSrc: `/mp3/${encodeURIComponent(filename)}`,
        wordCount,
      } satisfies Clip;
    })
    .filter((clip): clip is Clip => clip !== null);
