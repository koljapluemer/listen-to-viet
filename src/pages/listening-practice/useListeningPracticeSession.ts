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
  listPracticeEvents,
  readPracticeExportSnapshot,
  saveLearningRecord,
} from "../../entities/practice-progress/storage";
import {
  createUpdatedLearningRecord,
  getWeakestLearningRecord,
  toPracticeEventAnalytics,
  toStoredClip,
  type LearningRecord,
  type PracticeEvent,
} from "../../entities/practice-progress/model";
import { chooseDistractorCandidate } from "../../entities/practice-progress/stats";

export interface AnswerOption {
  label: string;
  isCorrect: boolean;
}

interface Round {
  clip: Clip;
  candidate: DistractorCandidate;
  options: AnswerOption[];
}

interface SessionLearningRecord {
  clip: Clip;
  model: Model;
  timestamp: string;
}

type Phase = "loading" | "ready" | "wrong";

const MAX_WORDS = 5;
const REVIEW_THRESHOLD = 0.7;
const REVIEW_PROBABILITY = 0.8;
const INTERACTIVE_TAG_NAMES = new Set(["A", "AUDIO", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

const shuffle = <T>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const downloadJson = (payload: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const useListeningPracticeSession = () => {
  const clips = ref<Clip[]>([]);
  const practiceEvents = ref<PracticeEvent[]>([]);
  const learningRecords = ref<SessionLearningRecord[]>([]);
  const round = ref<Round | null>(null);
  const phase = ref<Phase>("loading");
  const disabledButtonIndex = ref<number | null>(null);
  const audioRef = ref<HTMLAudioElement | null>(null);
  const taskStartTime = ref<number | null>(null);
  const autoplayHint = ref("");
  const loadError = ref("");
  const highlightChange = ref(false);

  const answerOptions = computed(() => round.value?.options ?? []);
  const changedCharacterIndex = computed(() => round.value?.candidate.changedIndex ?? -1);

  const splitLabel = (label: string) => [...label];

  const isInteractiveShortcutTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.isContentEditable || INTERACTIVE_TAG_NAMES.has(target.tagName);
  };

  const createRound = (clip: Clip): Round | null => {
    const candidates = listDistractorCandidates(clip.transcript);
    const candidate = chooseDistractorCandidate(candidates, practiceEvents.value);

    if (!candidate) {
      return null;
    }

    return {
      clip,
      candidate,
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

    let nextRound: Round | null = null;

    for (let attempt = 0; attempt < 10 && !nextRound; attempt += 1) {
      nextRound = createRound(pickNextClip());
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

  const exportProgress = async () => {
    const payload = await readPracticeExportSnapshot();

    downloadJson(
      payload,
      `viet-listening-progress-${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  const loadSessionState = async () => {
    const transcriptResponse = await fetch("/transcriptAll.txt");

    if (!transcriptResponse.ok) {
      throw new Error("Could not load transcript data.");
    }

    const transcriptText = await transcriptResponse.text();
    const parsedClips = parseTranscriptFile(transcriptText, MAX_WORDS);
    const clipsByFilename = new Map(parsedClips.map((clip) => [clip.filename, clip]));
    const [storedLearningRecords, storedPracticeEvents] = await Promise.all([
      listLearningRecords(),
      listPracticeEvents(),
    ]);

    clips.value = parsedClips;
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
  });

  return {
    answerOptions,
    audioRef,
    autoplayHint,
    changedCharacterIndex,
    disabledButtonIndex,
    exportProgress,
    handleAnswer,
    highlightChange,
    loadError,
    phase,
    replayAudio,
    round,
    splitLabel,
  };
};
