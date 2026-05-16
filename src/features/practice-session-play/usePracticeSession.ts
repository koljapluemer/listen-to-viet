import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { type Clip, type DistractorCandidate } from "../../entities/listening-clip/model";
import {
  appendPracticeEvent,
  listPracticeEvents,
} from "../../entities/practice-progress/storage";
import {
  toPracticeEventAnalytics,
  toStoredClip,
  type PracticeEvent,
  type PracticeRoundSelectionMode,
} from "../../entities/practice-progress/model";
import {
  getBidirectionalPairHistory,
  getBidirectionalPracticePairKey,
  getCandidatePairTarget,
  type PairHistoryStats,
  type PracticePairTarget,
} from "../../entities/practice-progress/stats";
import { buildPracticeCatalog, parsePracticeClips } from "./catalog";
import type { AnswerOption, PracticeCatalogEntry, PracticeSessionConfig } from "./model";

interface Round {
  clip: Clip;
  candidate: DistractorCandidate;
  options: AnswerOption[];
  selectionMode: PracticeRoundSelectionMode;
}

interface ExerciseCandidate {
  clip: Clip;
  candidate: DistractorCandidate;
  pairTarget: PracticePairTarget;
}

type Phase = "loading" | "ready" | "wrong";

const BATCH_SIZE = 3;
const MAX_ROUND_GENERATION_ATTEMPTS = 100;
const INTERACTIVE_TAG_NAMES = new Set(["A", "AUDIO", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

const shuffle = <T>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const pickRandom = <T>(items: T[]) => {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)] ?? null;
};

const getStrategyBScore = (pairHistory: PairHistoryStats | undefined) => {
  if (!pairHistory || pairHistory.recentAttempts === 0 || pairHistory.recentAccuracy === null) {
    return -1;
  }

  return pairHistory.recentAccuracy;
};

const getSessionMeta = (config: PracticeSessionConfig) => {
  const metaPair = config.metaPair ?? config.pairFilter;

  return {
    metaMode: config.metaMode,
    metaPairKind: metaPair?.kind,
    metaPairLeftKey: metaPair?.correctKey,
    metaPairRightKey: metaPair?.distractorKey,
  } satisfies Pick<PracticeEvent, "metaMode" | "metaPairKind" | "metaPairLeftKey" | "metaPairRightKey">;
};

export const usePracticeSession = (config: PracticeSessionConfig) => {
  const clips = ref<Clip[]>([]);
  const practiceEvents = ref<PracticeEvent[]>([]);
  const round = ref<Round | null>(null);
  const phase = ref<Phase>("loading");
  const disabledButtonIndex = ref<number | null>(null);
  const audioRef = ref<HTMLAudioElement | null>(null);
  const taskStartTime = ref<number | null>(null);
  const currentListeningMs = ref(0);
  const currentListeningClip = ref<ReturnType<typeof toStoredClip> | null>(null);
  const currentListeningDistractor = ref<string | undefined>(undefined);
  const currentListeningSelectionMode = ref<PracticeRoundSelectionMode | undefined>(undefined);
  const lastAudioPositionSeconds = ref<number | null>(null);
  const autoplayHint = ref("");
  const loadError = ref("");
  let clipCatalog: PracticeCatalogEntry[] = [];

  const answerOptions = computed(() => round.value?.options ?? []);
  const changedCharacterIndex = computed(() => round.value?.candidate.changedIndex ?? -1);

  const splitLabel = (label: string) => [...label];

  const isInteractiveShortcutTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.isContentEditable || INTERACTIVE_TAG_NAMES.has(target.tagName);
  };

  const sampleCatalogEntries = () =>
    shuffle(clipCatalog).slice(0, Math.min(BATCH_SIZE, clipCatalog.length));

  const getSampledExercises = (entries: PracticeCatalogEntry[]) =>
    entries.flatMap((entry) =>
      entry.candidates
        .map((candidate) => {
          const pairTarget = getCandidatePairTarget(candidate);

          if (!pairTarget) {
            return null;
          }

          return {
            clip: entry.clip,
            candidate,
            pairTarget,
          } satisfies ExerciseCandidate;
        })
        .filter((exercise): exercise is ExerciseCandidate => exercise !== null)
    );

  const groupExercisesByPair = (exercises: ExerciseCandidate[]) => {
    const groups = new Map<string, ExerciseCandidate[]>();

    exercises.forEach((exercise) => {
      const pairKey = getBidirectionalPracticePairKey(
        exercise.pairTarget.kind,
        exercise.pairTarget.correctKey,
        exercise.pairTarget.distractorKey
      );
      const current = groups.get(pairKey) ?? [];

      current.push(exercise);
      groups.set(pairKey, current);
    });

    return groups;
  };

  const createRound = (
    exercise: ExerciseCandidate,
    selectionMode: PracticeRoundSelectionMode
  ): Round => ({
    clip: exercise.clip,
    candidate: exercise.candidate,
    selectionMode,
    options: shuffle([
      { label: exercise.clip.transcript, isCorrect: true },
      { label: exercise.candidate.label, isCorrect: false },
    ]),
  });

  const chooseStrategyAExercise = (
    pairExercises: Map<string, ExerciseCandidate[]>,
    pairHistory: Map<string, PairHistoryStats>
  ) => {
    const undertrainedExercises = [...pairExercises.entries()]
      .filter(([pairKey]) => (pairHistory.get(pairKey)?.attempts ?? 0) < 10)
      .flatMap(([, exercises]) => exercises);

    return pickRandom(undertrainedExercises.length ? undertrainedExercises : [...pairExercises.values()].flat());
  };

  const chooseStrategyBExercise = (
    pairExercises: Map<string, ExerciseCandidate[]>,
    pairHistory: Map<string, PairHistoryStats>
  ) => {
    let lowestScore = Number.POSITIVE_INFINITY;
    let weakestPairKeys: string[] = [];

    pairExercises.forEach((_, pairKey) => {
      const score = getStrategyBScore(pairHistory.get(pairKey));

      if (score < lowestScore) {
        lowestScore = score;
        weakestPairKeys = [pairKey];
        return;
      }

      if (score === lowestScore) {
        weakestPairKeys.push(pairKey);
      }
    });

    const selectedPairKey = pickRandom(weakestPairKeys);

    return selectedPairKey ? pickRandom(pairExercises.get(selectedPairKey) ?? []) : null;
  };

  const generateNextRound = () => {
    const pairHistory = getBidirectionalPairHistory(practiceEvents.value);

    for (let attempt = 0; attempt < MAX_ROUND_GENERATION_ATTEMPTS; attempt += 1) {
      const sampledEntries = sampleCatalogEntries();
      const sampledExercises = getSampledExercises(sampledEntries);

      if (!sampledExercises.length) {
        continue;
      }

      const pairExercises = groupExercisesByPair(sampledExercises);
      const useStrategyB = Math.random() > 0.5;
      const selectionMode: PracticeRoundSelectionMode = useStrategyB ? "strategyB" : "strategyA";
      const selectedExercise = useStrategyB
        ? chooseStrategyBExercise(pairExercises, pairHistory)
        : chooseStrategyAExercise(pairExercises, pairHistory);

      if (selectedExercise) {
        return createRound(selectedExercise, selectionMode);
      }
    }

    return null;
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

    resetAudioPlaybackTracking();

    if (!clip || listenedDurationMs < 250) {
      return;
    }

    const audioListenedEvent: PracticeEvent = {
      eventType: "audioListened",
      clip,
      timestamp: new Date().toISOString(),
      selectionMode,
      distractor,
      duration_ms: listenedDurationMs,
      ...getSessionMeta(config),
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
      loadError.value = config.pairFilter
        ? "No practice clips found for this pair."
        : "No clips matched the current transcript filter.";
      round.value = null;
      phase.value = "loading";
      return;
    }

    phase.value = "loading";
    disabledButtonIndex.value = null;
    autoplayHint.value = "";
    loadError.value = "";

    const nextRound = generateNextRound();

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
      distractor: nextRound.candidate.label,
      ...getSessionMeta(config),
    };

    await appendPracticeEvent(roundStartedEvent);
    practiceEvents.value.push(roundStartedEvent);

    phase.value = "ready";
    taskStartTime.value = Date.now();

    await nextTick();
    await replayAudio();
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
        distractor: round.value.candidate.label,
        duration_ms: taskStartTime.value === null ? null : Date.now() - taskStartTime.value,
        selectedTranscript: option.label,
        isCorrect: option.isCorrect,
        ...getSessionMeta(config),
        ...toPracticeEventAnalytics(round.value.candidate),
      };

      await appendPracticeEvent(answerEvent);
      practiceEvents.value.push(answerEvent);
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
    const parsedClips = parsePracticeClips(transcriptText);
    clipCatalog = buildPracticeCatalog(parsedClips, config.pairFilter);

    clips.value = clipCatalog.map((entry) => entry.clip);
    practiceEvents.value = await listPracticeEvents();
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
