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

export const ACTIVE_LETTER_KEYS = [
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
] as const;

export const TONE_KEYS = ["ngang", "huyen", "sac", "hoi", "nga", "nang"] as const;

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

interface TokenSpan {
  start: number;
  end: number;
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

const transcriptCleanupPattern = /(^|\s)-N(?=\s|$)/g;
const wordSplitPattern = /\s+/;
const alphabeticCharacterPattern = /^\p{L}$/u;
const vietnameseAlphabetCharacters = [
  "a",
  "ă",
  "â",
  "b",
  "c",
  "d",
  "đ",
  "e",
  "ê",
  "g",
  "h",
  "i",
  "k",
  "l",
  "m",
  "n",
  "o",
  "ô",
  "ơ",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "ư",
  "v",
  "x",
  "y",
  ...vowelFamilies.flatMap((family) => family.slice(1)),
] as const;
const directlyRemovedLetterPairs = new Set(["i->y", "y->i"]);

const buildCharacterSet = (characters: readonly string[]) => {
  const set = new Set<string>();

  characters.forEach((character) => {
    set.add(character);
    set.add(character.toUpperCase());
  });

  return set;
};

const toneMarkedCharacterSet = buildCharacterSet(vowelFamilies.flatMap((family) => family.slice(1)));
const definitelyVietnameseCharacterSet = buildCharacterSet([
  "ă",
  "â",
  "ê",
  "ô",
  "ơ",
  "ư",
  "đ",
  ...vowelFamilies.flatMap((family) => family.slice(1)),
]);
const vietnameseAlphabetCharacterSet = buildCharacterSet(vietnameseAlphabetCharacters);
const activeLetterKeySet = new Set<string>(ACTIVE_LETTER_KEYS);

export function isSupportedLetterPair(correctLetter: string, distractorLetter: string) {
  if (!activeLetterKeySet.has(correctLetter) || !activeLetterKeySet.has(distractorLetter)) {
    return false;
  }

  return !directlyRemovedLetterPairs.has(`${correctLetter}->${distractorLetter}`);
}

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

  for (let familyIndex = 0; familyIndex < vowelFamilies.length; familyIndex += 1) {
    const family = vowelFamilies[familyIndex];
    const sourceLetter = family[0];

    for (let toneIndex = 0; toneIndex < family.length; toneIndex += 1) {
      const source = family[toneIndex];

      for (let otherFamilyIndex = 0; otherFamilyIndex < vowelFamilies.length; otherFamilyIndex += 1) {
        if (otherFamilyIndex === familyIndex) {
          continue;
        }

        const candidateFamily = vowelFamilies[otherFamilyIndex];
        const candidateLetter = candidateFamily[0];

        if (!isSupportedLetterPair(sourceLetter, candidateLetter)) {
          continue;
        }

        addAlternative(source, candidateFamily[toneIndex]);
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

const isAlphabeticCharacter = (character: string) => alphabeticCharacterPattern.test(character);

const getTokenSpans = (characters: string[]) => {
  const spans: TokenSpan[] = [];
  let tokenStart: number | null = null;

  characters.forEach((character, index) => {
    if (isAlphabeticCharacter(character)) {
      if (tokenStart === null) {
        tokenStart = index;
      }

      return;
    }

    if (tokenStart !== null) {
      spans.push({
        start: tokenStart,
        end: index,
      });
      tokenStart = null;
    }
  });

  if (tokenStart !== null) {
    spans.push({
      start: tokenStart,
      end: characters.length,
    });
  }

  return spans;
};

const getTokenSpanForIndex = (tokenSpans: TokenSpan[], index: number) => {
  for (const span of tokenSpans) {
    if (index >= span.start && index < span.end) {
      return span;
    }
  }

  return null;
};

const isVietnameseConfirmedToken = (token: string) =>
  [...token].some((character) => definitelyVietnameseCharacterSet.has(character));

const hasOnlyVietnameseAlphabetCharacters = (token: string) =>
  [...token].every(
    (character) => !isAlphabeticCharacter(character) || vietnameseAlphabetCharacterSet.has(character)
  );

const isValidSourceToken = (token: string) =>
  isVietnameseConfirmedToken(token) && hasOnlyVietnameseAlphabetCharacters(token);

const getToneMarkedCharacterCount = (token: string) =>
  [...token].filter((character) => toneMarkedCharacterSet.has(character)).length;

const isValidMutatedToken = (token: string) => getToneMarkedCharacterCount(token) <= 1;

const getCharacterMetadata = (character: string) => characterMetadataMap.get(character) ?? null;

const getConfusionKind = (
  sourceMetadata: CharacterMetadata,
  candidateMetadata: CharacterMetadata
): ConfusionKind | null => {
  if (sourceMetadata.letter !== candidateMetadata.letter) {
    return isSupportedLetterPair(sourceMetadata.letter, candidateMetadata.letter) ? "letter" : null;
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

const listDistractorCandidatesInternal = (transcript: string, stopAfterFirst = false) => {
  const normalizedTranscript = normalizeTranscript(transcript);
  const characters = [...normalizedTranscript];
  const tokenSpans = getTokenSpans(characters);
  const candidates: DistractorCandidate[] = [];

  for (let changedIndex = 0; changedIndex < characters.length; changedIndex += 1) {
    const character = characters[changedIndex];
    const sourceMetadata = getCharacterMetadata(character);
    const alternatives = alternativeMap.get(character);

    if (!sourceMetadata || !alternatives?.length) {
      continue;
    }

    const tokenSpan = getTokenSpanForIndex(tokenSpans, changedIndex);

    if (!tokenSpan) {
      continue;
    }

    const sourceToken = characters.slice(tokenSpan.start, tokenSpan.end).join("");

    if (!isValidSourceToken(sourceToken)) {
      continue;
    }

    for (const alternative of alternatives) {
      const candidateMetadata = getCharacterMetadata(alternative);

      if (!candidateMetadata) {
        continue;
      }

      const kind = getConfusionKind(sourceMetadata, candidateMetadata);

      if (!kind) {
        continue;
      }

      const mutated = [...characters];
      mutated[changedIndex] = alternative;
      const label = mutated.join("");

      if (label === normalizedTranscript) {
        continue;
      }

      const mutatedToken = mutated.slice(tokenSpan.start, tokenSpan.end).join("");

      if (!isValidMutatedToken(mutatedToken)) {
        continue;
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

      if (stopAfterFirst) {
        return candidates;
      }
    }
  }

  return candidates;
};

export const canGenerateDistractor = (transcript: string) =>
  listDistractorCandidatesInternal(transcript, true).length > 0;

export const listDistractorCandidates = (transcript: string) =>
  shuffle(listDistractorCandidatesInternal(transcript));

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
