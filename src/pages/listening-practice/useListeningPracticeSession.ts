import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import type { Model } from "ebisu-js/interfaces";
import {
  type Clip,
  type DistractorCandidate,
  listDistractorCandidates,
  parseTranscriptFile,
} from "../../entities/listening-clip/model";
import {
  appendPracticeEvent,
  listLearningRecords,
  rewritePracticeEvents,
  saveLearningRecord,
} from "../../entities/practice-progress/storage";
import {
  createUpdatedLearningRecord,
  getWeakestLearningRecord,
  toPracticeEventAnalytics,
  toStoredClip,
  type LearningRecord,
  type PracticeEvent,
  type PracticeRoundSelectionMode,
  type PracticeSelectionMetaMode,
} from "../../entities/practice-progress/model";
import {
  chooseDistractorCandidate,
  getWeakestRecentPairTarget,
  type PracticePairTarget,
} from "../../entities/practice-progress/stats";

export interface AnswerOption {
  label: string;
  isCorrect: boolean;
}

interface Round {
  clip: Clip;
  candidate: DistractorCandidate;
  options: AnswerOption[];
  selectionMode: PracticeRoundSelectionMode;
  metaMode: PracticeSelectionMetaMode;
  metaBlockIndex: number;
  metaPairTarget: PracticePairTarget | null;
}

interface SessionLearningRecord {
  clip: Clip;
  model: Model;
  timestamp: string;
}

interface ClipCatalogEntry {
  clip: Clip;
  candidates: DistractorCandidate[];
}

interface PairInventoryEntry {
  clip: Clip;
  candidate: DistractorCandidate;
}

type Phase = "loading" | "ready" | "wrong";

const MAX_WORDS = 5;
const REVIEW_THRESHOLD = 0.7;
const REVIEW_PROBABILITY = 0.8;
const FULLY_RANDOM_ROUND_PROBABILITY = 0.5;
const META_MODE_BLOCK_SIZE = 20;
const INTERACTIVE_TAG_NAMES = new Set(["A", "AUDIO", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

const shuffle = <T>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const getBidirectionalPairInventoryKey = (
  kind: PracticePairTarget["kind"],
  leftKey: string,
  rightKey: string
) => `${kind}:${[leftKey, rightKey].sort((left, right) => left.localeCompare(right)).join("|")}`;

export const useListeningPracticeSession = () => {
  const clips = ref<Clip[]>([]);
  const practiceEvents = ref<PracticeEvent[]>([]);
  const learningRecords = ref<SessionLearningRecord[]>([]);
  const round = ref<Round | null>(null);
  const phase = ref<Phase>("loading");
  const disabledButtonIndex = ref<number | null>(null);
  const audioRef = ref<HTMLAudioElement | null>(null);
  const taskStartTime = ref<number | null>(null);
  const currentListeningMs = ref(0);
  const currentListeningClip = ref<ReturnType<typeof toStoredClip> | null>(null);
  const currentListeningDistractor = ref<string | undefined>(undefined);
  const currentListeningSelectionMode = ref<PracticeRoundSelectionMode | undefined>(undefined);
  const currentListeningMetaMode = ref<PracticeSelectionMetaMode | undefined>(undefined);
  const currentListeningMetaBlockIndex = ref<number | undefined>(undefined);
  const currentListeningMetaPairTarget = ref<PracticePairTarget | null>(null);
  const lastAudioPositionSeconds = ref<number | null>(null);
  const autoplayHint = ref("");
  const loadError = ref("");
  let clipCatalog: ClipCatalogEntry[] = [];
  let clipCatalogByFilename = new Map<string, ClipCatalogEntry>();
  let pairInventory = new Map<string, PairInventoryEntry[]>();

  const answerOptions = computed(() => round.value?.options ?? []);
  const changedCharacterIndex = computed(() => round.value?.candidate.changedIndex ?? -1);

  const splitLabel = (label: string) => [...label];

  const isInteractiveShortcutTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.isContentEditable || INTERACTIVE_TAG_NAMES.has(target.tagName);
  };

  const buildClipCatalog = (availableClips: Clip[]) =>
    availableClips
      .map((clip) => {
        const candidates = listDistractorCandidates(clip.transcript);

        if (!candidates.length) {
          return null;
        }

        return {
          clip,
          candidates,
        } satisfies ClipCatalogEntry;
      })
      .filter((entry): entry is ClipCatalogEntry => entry !== null);

  const buildPairInventory = (catalog: ClipCatalogEntry[]) => {
    const nextInventory = new Map<string, PairInventoryEntry[]>();

    catalog.forEach((entry) => {
      entry.candidates.forEach((candidate) => {
        const leftKey = candidate.kind === "letter" ? candidate.correctLetter : candidate.correctTone;
        const rightKey = candidate.kind === "letter" ? candidate.distractorLetter : candidate.distractorTone;

        if (!leftKey || !rightKey) {
          return;
        }

        const inventoryKey = getBidirectionalPairInventoryKey(candidate.kind, leftKey, rightKey);
        const currentEntries = nextInventory.get(inventoryKey) ?? [];

        currentEntries.push({
          clip: entry.clip,
          candidate,
        });
        nextInventory.set(inventoryKey, currentEntries);
      });
    });

    return nextInventory;
  };

  const getCatalogEntry = (clip: Clip) => clipCatalogByFilename.get(clip.filename) ?? null;

  const pickLearningCandidate = (candidates: DistractorCandidate[]) =>
    chooseDistractorCandidate(candidates, practiceEvents.value) ?? candidates[0] ?? null;

  const hasRealizablePairTarget = (pairTarget: PracticePairTarget) =>
    pairInventory.has(
      getBidirectionalPairInventoryKey(pairTarget.kind, pairTarget.correctKey, pairTarget.distractorKey)
    );

  const stripPracticeEventAnalytics = (event: PracticeEvent) => ({
    ...event,
    analyticsVersion: undefined,
    changedIndex: undefined,
    confusionKind: undefined,
    correctCharacter: undefined,
    distractorCharacter: undefined,
    correctLetter: undefined,
    distractorLetter: undefined,
    correctTone: undefined,
    distractorTone: undefined,
  });

  const stripPracticeEventMetaPair = (event: PracticeEvent) => ({
    ...event,
    metaPairKind: undefined,
    metaPairLeftKey: undefined,
    metaPairRightKey: undefined,
  });

  const getAnalyticsPairTarget = (event: PracticeEvent): PracticePairTarget | null => {
    if (event.confusionKind === "letter" && event.correctLetter && event.distractorLetter) {
      return {
        kind: "letter",
        correctKey: event.correctLetter,
        distractorKey: event.distractorLetter,
      };
    }

    if (event.confusionKind === "tone" && event.correctTone && event.distractorTone) {
      return {
        kind: "tone",
        correctKey: event.correctTone,
        distractorKey: event.distractorTone,
      };
    }

    return null;
  };

  const getMetaPairTargetFromEvent = (event: PracticeEvent): PracticePairTarget | null => {
    if (!event.metaPairKind || !event.metaPairLeftKey || !event.metaPairRightKey) {
      return null;
    }

    return {
      kind: event.metaPairKind,
      correctKey: event.metaPairLeftKey,
      distractorKey: event.metaPairRightKey,
    };
  };

  const sanitizeStoredPracticeEvent = (event: PracticeEvent) => {
    let sanitizedEvent = event;
    const analyticsPairTarget = getAnalyticsPairTarget(sanitizedEvent);

    if (
      sanitizedEvent.analyticsVersion === 1 ||
      sanitizedEvent.confusionKind ||
      sanitizedEvent.correctLetter ||
      sanitizedEvent.distractorLetter ||
      sanitizedEvent.correctTone !== undefined ||
      sanitizedEvent.distractorTone !== undefined
    ) {
      if (!analyticsPairTarget || !hasRealizablePairTarget(analyticsPairTarget)) {
        sanitizedEvent = stripPracticeEventAnalytics(sanitizedEvent);
      }
    }

    const metaPairTarget = getMetaPairTargetFromEvent(sanitizedEvent);

    if (
      sanitizedEvent.metaPairKind ||
      sanitizedEvent.metaPairLeftKey ||
      sanitizedEvent.metaPairRightKey
    ) {
      if (!metaPairTarget || !hasRealizablePairTarget(metaPairTarget)) {
        sanitizedEvent = stripPracticeEventMetaPair(sanitizedEvent);
      }
    }

    return sanitizedEvent;
  };

  const createRound = (clip: Clip, metaBlockIndex: number): Round | null => {
    const catalogEntry = getCatalogEntry(clip);
    const candidate = catalogEntry ? pickLearningCandidate(catalogEntry.candidates) : null;

    if (!candidate) {
      return null;
    }

    return {
      clip,
      candidate,
      selectionMode: "learningPrediction",
      metaMode: "default",
      metaBlockIndex,
      metaPairTarget: null,
      options: shuffle([
        { label: clip.transcript, isCorrect: true },
        { label: candidate.label, isCorrect: false },
      ]),
    };
  };

  const createRandomRound = (clip: Clip, metaBlockIndex: number): Round | null => {
    const candidates = getCatalogEntry(clip)?.candidates ?? [];

    if (!candidates.length) {
      return null;
    }

    const candidate = candidates[Math.floor(Math.random() * candidates.length)];

    return {
      clip,
      candidate,
      selectionMode: "random",
      metaMode: "default",
      metaBlockIndex,
      metaPairTarget: null,
      options: shuffle([
        { label: clip.transcript, isCorrect: true },
        { label: candidate.label, isCorrect: false },
      ]),
    };
  };

  const pickNextClip = () => {
    const weakestLearningRecord = getWeakestLearningRecord(learningRecords.value);

    if (
      weakestLearningRecord &&
      weakestLearningRecord.recall < REVIEW_THRESHOLD &&
      Math.random() < REVIEW_PROBABILITY
    ) {
      return weakestLearningRecord.record.clip;
    }

    return clips.value[Math.floor(Math.random() * clips.value.length)];
  };

  const getCurrentMetaMode = (): { blockIndex: number; metaMode: PracticeSelectionMetaMode } => {
    const completedExercises = practiceEvents.value.filter((event) => event.eventType === "answer").length;
    const blockIndex = Math.floor(completedExercises / META_MODE_BLOCK_SIZE);

    return {
      blockIndex,
      metaMode: blockIndex % 2 === 0 ? "default" : "weakestPairBidirectional",
    };
  };

  const getPersistedMetaPairTarget = (blockIndex: number): PracticePairTarget | null => {
    const matchingEvent = [...practiceEvents.value]
      .reverse()
      .find(
        (event) =>
          event.metaMode === "weakestPairBidirectional" &&
          event.metaBlockIndex === blockIndex &&
          event.metaPairKind &&
          event.metaPairLeftKey &&
          event.metaPairRightKey
      );

    if (!matchingEvent?.metaPairKind || !matchingEvent.metaPairLeftKey || !matchingEvent.metaPairRightKey) {
      return null;
    }

    const pairTarget = {
      kind: matchingEvent.metaPairKind,
      correctKey: matchingEvent.metaPairLeftKey,
      distractorKey: matchingEvent.metaPairRightKey,
    };

    return hasRealizablePairTarget(pairTarget) ? pairTarget : null;
  };

  const createWeakestPairRound = (
    pairTarget: PracticePairTarget,
    metaBlockIndex: number
  ): Round | null => {
    const inventoryEntries = pairInventory.get(
      getBidirectionalPairInventoryKey(pairTarget.kind, pairTarget.correctKey, pairTarget.distractorKey)
    );

    if (!inventoryEntries?.length) {
      return null;
    }

    const inventoryEntry = inventoryEntries[Math.floor(Math.random() * inventoryEntries.length)];

    return {
      clip: inventoryEntry.clip,
      candidate: inventoryEntry.candidate,
      selectionMode: "random",
      metaMode: "weakestPairBidirectional",
      metaBlockIndex,
      metaPairTarget: pairTarget,
      options: shuffle([
        { label: inventoryEntry.clip.transcript, isCorrect: true },
        { label: inventoryEntry.candidate.label, isCorrect: false },
      ]),
    };
  };

  const replayAudio = async () => {
    const audio = audioRef.value;

    if (!audio) {
      return;
    }

    autoplayHint.value = "";
    audio.pause();
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      autoplayHint.value = "Autoplay was blocked. Press replay.";
    }
  };

  const resetAudioPlaybackTracking = () => {
    currentListeningMs.value = 0;
    currentListeningClip.value = null;
    currentListeningDistractor.value = undefined;
    currentListeningSelectionMode.value = undefined;
    currentListeningMetaMode.value = undefined;
    currentListeningMetaBlockIndex.value = undefined;
    currentListeningMetaPairTarget.value = null;
    lastAudioPositionSeconds.value = null;
  };

  const updateCurrentListeningMs = () => {
    const audio = audioRef.value;

    if (!audio || lastAudioPositionSeconds.value === null) {
      return;
    }

    const progressedSeconds = audio.currentTime - lastAudioPositionSeconds.value;

    if (progressedSeconds > 0) {
      currentListeningMs.value += progressedSeconds * 1000;
    }

    lastAudioPositionSeconds.value = audio.currentTime;
  };

  const handleAudioPlay = () => {
    const audio = audioRef.value;

    if (!audio || !round.value || lastAudioPositionSeconds.value !== null) {
      return;
    }

    currentListeningClip.value = toStoredClip(round.value.clip);
    currentListeningDistractor.value = round.value.candidate.label;
    currentListeningSelectionMode.value = round.value.selectionMode;
    currentListeningMetaMode.value = round.value.metaMode;
    currentListeningMetaBlockIndex.value = round.value.metaBlockIndex;
    currentListeningMetaPairTarget.value = round.value.metaPairTarget;
    lastAudioPositionSeconds.value = audio.currentTime;
  };

  const handleAudioTimeUpdate = () => {
    updateCurrentListeningMs();
  };

  const handleAudioSeek = () => {
    const audio = audioRef.value;

    if (!audio || lastAudioPositionSeconds.value === null) {
      return;
    }

    lastAudioPositionSeconds.value = audio.currentTime;
  };

  const finalizeAudioPlaybackTracking = async () => {
    updateCurrentListeningMs();

    const listenedDurationMs = Math.round(currentListeningMs.value);
    const clip = currentListeningClip.value;
    const distractor = currentListeningDistractor.value;
    const selectionMode = currentListeningSelectionMode.value;
    const metaMode = currentListeningMetaMode.value;
    const metaBlockIndex = currentListeningMetaBlockIndex.value;
    const metaPairTarget = currentListeningMetaPairTarget.value;

    resetAudioPlaybackTracking();

    if (!clip || listenedDurationMs < 250) {
      return;
    }

    const audioListenedEvent: PracticeEvent = {
      eventType: "audioListened",
      clip,
      timestamp: new Date().toISOString(),
      selectionMode,
      metaMode,
      metaBlockIndex,
      metaPairKind: metaPairTarget?.kind,
      metaPairLeftKey: metaPairTarget?.correctKey,
      metaPairRightKey: metaPairTarget?.distractorKey,
      distractor,
      duration_ms: listenedDurationMs,
    };

    await appendPracticeEvent(audioListenedEvent);
    practiceEvents.value.push(audioListenedEvent);
  };

  const handleAudioPause = () => {
    void finalizeAudioPlaybackTracking();
  };

  const handleAudioEnded = () => {
    void finalizeAudioPlaybackTracking();
  };

  const setNextRound = async () => {
    if (!clips.value.length) {
      loadError.value = "No clips matched the current transcript filter.";
      round.value = null;
      phase.value = "loading";
      return;
    }

    phase.value = "loading";
    disabledButtonIndex.value = null;
    autoplayHint.value = "";
    loadError.value = "";

    const { blockIndex, metaMode } = getCurrentMetaMode();
    let nextRound: Round | null = null;

    if (metaMode === "weakestPairBidirectional") {
      const pairTarget = getPersistedMetaPairTarget(blockIndex) ?? getWeakestRecentPairTarget(practiceEvents.value);

      if (pairTarget) {
        nextRound = createWeakestPairRound(pairTarget, blockIndex);
      }
    }

    if (!nextRound) {
      const useFullyRandomRound = Math.random() < FULLY_RANDOM_ROUND_PROBABILITY;

      for (let attempt = 0; attempt < 10 && !nextRound; attempt += 1) {
        const clip = useFullyRandomRound
          ? clips.value[Math.floor(Math.random() * clips.value.length)]
          : pickNextClip();
        nextRound = useFullyRandomRound ? createRandomRound(clip, blockIndex) : createRound(clip, blockIndex);
      }
    }

    if (!nextRound) {
      loadError.value = "Could not generate a distinct distractor for the available clips.";
      round.value = null;
      return;
    }

    round.value = nextRound;

    const roundStartedEvent: PracticeEvent = {
      eventType: "roundStarted",
      clip: toStoredClip(nextRound.clip),
      timestamp: new Date().toISOString(),
      selectionMode: nextRound.selectionMode,
      metaMode: nextRound.metaMode,
      metaBlockIndex: nextRound.metaBlockIndex,
      metaPairKind: nextRound.metaPairTarget?.kind,
      metaPairLeftKey: nextRound.metaPairTarget?.correctKey,
      metaPairRightKey: nextRound.metaPairTarget?.distractorKey,
      distractor: nextRound.candidate.label,
    };

    await appendPracticeEvent(roundStartedEvent);
    practiceEvents.value.push(roundStartedEvent);

    phase.value = "ready";
    taskStartTime.value = Date.now();

    await nextTick();
    await replayAudio();
  };

  const storeUpdatedLearningRecord = async (clip: Clip, isCorrect: boolean) => {
    const storedClip = toStoredClip(clip);
    const existingRecord = learningRecords.value.find((record) => record.clip.filename === clip.filename);
    const existingSnapshot: LearningRecord | null = existingRecord
      ? {
          clip: toStoredClip(existingRecord.clip),
          model: [...existingRecord.model] as Model,
          timestamp: existingRecord.timestamp,
        }
      : null;
    const updatedRecord = createUpdatedLearningRecord(existingSnapshot, storedClip, isCorrect);

    await saveLearningRecord(updatedRecord);

    if (!existingRecord) {
      learningRecords.value.push({
        clip,
        model: [...updatedRecord.model] as Model,
        timestamp: updatedRecord.timestamp,
      });
      return;
    }

    existingRecord.model = [...updatedRecord.model] as Model;
    existingRecord.timestamp = updatedRecord.timestamp;
  };

  const handleAnswer = async (option: AnswerOption, buttonIndex: number) => {
    if (!round.value) {
      return;
    }

    if (phase.value !== "ready" && phase.value !== "wrong") {
      return;
    }

    if (disabledButtonIndex.value === buttonIndex) {
      return;
    }

    if (phase.value === "ready") {
      const answerEvent: PracticeEvent = {
        eventType: "answer",
        clip: toStoredClip(round.value.clip),
        timestamp: new Date().toISOString(),
        selectionMode: round.value.selectionMode,
        metaMode: round.value.metaMode,
        metaBlockIndex: round.value.metaBlockIndex,
        metaPairKind: round.value.metaPairTarget?.kind,
        metaPairLeftKey: round.value.metaPairTarget?.correctKey,
        metaPairRightKey: round.value.metaPairTarget?.distractorKey,
        distractor: round.value.candidate.label,
        duration_ms: taskStartTime.value === null ? null : Date.now() - taskStartTime.value,
        selectedTranscript: option.label,
        isCorrect: option.isCorrect,
        ...toPracticeEventAnalytics(round.value.candidate),
      };

      await appendPracticeEvent(answerEvent);
      practiceEvents.value.push(answerEvent);
      await storeUpdatedLearningRecord(round.value.clip, option.isCorrect);
    }

    if (option.isCorrect) {
      audioRef.value?.pause();
      await finalizeAudioPlaybackTracking();
      phase.value = "loading";
      await setNextRound();
      return;
    }

    phase.value = "wrong";
    disabledButtonIndex.value = buttonIndex;
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (phase.value !== "ready" && phase.value !== "wrong") {
      return;
    }

    if (event.code === "Space") {
      if (isInteractiveShortcutTarget(event.target)) {
        return;
      }

      event.preventDefault();
      void replayAudio();
      return;
    }

    if (answerOptions.value.length !== 2) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      void handleAnswer(answerOptions.value[0], 0);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      void handleAnswer(answerOptions.value[1], 1);
    }
  };

  const loadSessionState = async () => {
    const transcriptResponse = await fetch("/transcriptAll.txt");

    if (!transcriptResponse.ok) {
      throw new Error("Could not load transcript data.");
    }

    const transcriptText = await transcriptResponse.text();
    const parsedClips = parseTranscriptFile(transcriptText, MAX_WORDS);
    clipCatalog = buildClipCatalog(parsedClips);
    clipCatalogByFilename = new Map(clipCatalog.map((entry) => [entry.clip.filename, entry]));
    pairInventory = buildPairInventory(clipCatalog);

    const clipsByFilename = new Map(clipCatalog.map((entry) => [entry.clip.filename, entry.clip]));
    const [storedLearningRecords, storedPracticeEvents] = await Promise.all([
      listLearningRecords(),
      rewritePracticeEvents(sanitizeStoredPracticeEvent),
    ]);

    clips.value = clipCatalog.map((entry) => entry.clip);
    practiceEvents.value = storedPracticeEvents;
    learningRecords.value = storedLearningRecords
      .map((record) => {
        const clip = clipsByFilename.get(record.clip.filename);

        if (!clip) {
          return null;
        }

        return {
          clip,
          model: [...record.model] as Model,
          timestamp: record.timestamp,
        } satisfies SessionLearningRecord;
      })
      .filter((record): record is SessionLearningRecord => record !== null);
  };

  const initialize = async () => {
    try {
      await loadSessionState();
      await setNextRound();
    } catch {
      loadError.value = "Could not load transcript data.";
      round.value = null;
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
    void initialize();
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
    void finalizeAudioPlaybackTracking();
  });

  return {
    answerOptions,
    audioRef,
    autoplayHint,
    changedCharacterIndex,
    disabledButtonIndex,
    handleAnswer,
    handleAudioEnded,
    handleAudioPause,
    handleAudioPlay,
    handleAudioSeek,
    handleAudioTimeUpdate,
    loadError,
    phase,
    replayAudio,
    round,
    splitLabel,
  };
};
