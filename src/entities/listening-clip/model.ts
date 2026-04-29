export interface Clip {
  filename: string;
  transcript: string;
  timing: string;
  audioSrc: string;
  wordCount: number;
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
] as const;

const consonantFamilies = [["d", "đ"]] as const;

const confusableToneGroups = [
  [vowelFamilies[0], vowelFamilies[1], vowelFamilies[2]],
  [vowelFamilies[3], vowelFamilies[4]],
  [vowelFamilies[5], vowelFamilies[11]],
  [vowelFamilies[6], vowelFamilies[7], vowelFamilies[8]],
  [vowelFamilies[9], vowelFamilies[10]],
] as const;

const transcriptCleanupPattern = /(^|\s)-N(?=\s|$)/g;
const wordSplitPattern = /\s+/;

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

export const normalizeTranscript = (value: string) =>
  value.replace(transcriptCleanupPattern, " ").replace(wordSplitPattern, " ").trim();

export const countWords = (value: string) => {
  const normalized = normalizeTranscript(value);
  return normalized ? normalized.split(" ").length : 0;
};

export const canGenerateDistractor = (transcript: string) =>
  [...normalizeTranscript(transcript)].some((character) => alternativeMap.has(character));

export const generateDistractor = (transcript: string) => {
  const characters = [...normalizeTranscript(transcript)];
  const candidateIndexes = shuffle(
    characters
      .map((character, index) => (alternativeMap.has(character) ? index : -1))
      .filter((index) => index !== -1)
  );

  for (const characterIndex of candidateIndexes) {
    const originalCharacter = characters[characterIndex];
    const alternatives = shuffle(alternativeMap.get(originalCharacter) ?? []);

    for (const alternative of alternatives) {
      const mutated = [...characters];
      mutated[characterIndex] = alternative;
      const candidate = mutated.join("");

      if (candidate !== transcript) {
        return candidate;
      }
    }
  }

  return null;
};

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
