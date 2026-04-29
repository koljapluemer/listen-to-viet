<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import * as ebisu from "ebisu-js";
import type { Model } from "ebisu-js/interfaces";
import { generateDistractor, parseTranscriptFile, type Clip } from "../lib/listening";

interface StoredClip {
  filename: string;
  transcript: string;
}

interface PracticeEvent {
  eventType: "roundStarted" | "answer";
  clip: StoredClip;
  timestamp: string;
  distractor?: string;
  duration_ms?: number | null;
  selectedTranscript?: string;
  isCorrect?: boolean;
}

interface PracticeLearningEntry {
  clip: Clip;
  model: Model;
  timestamp: string;
}

interface StoredPracticeLearningEntry {
  clip: StoredClip;
  model: Model;
  timestamp: string;
}

interface AnswerOption {
  label: string;
  isCorrect: boolean;
}

interface Round {
  clip: Clip;
  distractor: string;
  options: AnswerOption[];
}

type Phase = "loading" | "ready" | "wrong";

const MAX_WORDS = 5;
const REVIEW_THRESHOLD = 0.7;
const REVIEW_PROBABILITY = 0.8;
const EVENT_STORAGE_KEY = "viet-listening-events";
const LEARNING_STORAGE_KEY = "viet-listening-learning";

const clips = ref<Clip[]>([]);
const round = ref<Round | null>(null);
const phase = ref<Phase>("loading");
const disabledButtonIndex = ref<number | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const taskStartTime = ref<number | null>(null);
const autoplayHint = ref("");
const loadError = ref("");

const readStoredJson = <T>(key: string, fallback: T): T => {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const practiceEvents = ref<PracticeEvent[]>(readStoredJson(EVENT_STORAGE_KEY, []));
const storedLearningEntries = ref<StoredPracticeLearningEntry[]>(
  readStoredJson(LEARNING_STORAGE_KEY, [])
);
const learningEntries = ref<PracticeLearningEntry[]>([]);

const answerOptions = computed(() => round.value?.options ?? []);

const toStoredClip = (clip: Clip): StoredClip => ({
  filename: clip.filename,
  transcript: clip.transcript,
});

const persistEvents = () => {
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(practiceEvents.value));
};

const persistLearningEntries = () => {
  const stored: StoredPracticeLearningEntry[] = learningEntries.value.map((entry) => ({
    clip: toStoredClip(entry.clip),
    model: entry.model,
    timestamp: entry.timestamp,
  }));
  localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(stored));
};

const shuffle = <T>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const getLeastLikelyRememberedClip = () => {
  if (!learningEntries.value.length) {
    return null;
  }

  let weakestEntry = learningEntries.value[0];
  let lowestRecall = ebisu.predictRecall(
    weakestEntry.model,
    Math.floor((Date.now() - new Date(weakestEntry.timestamp).getTime()) / 1000),
    true
  );

  for (const entry of learningEntries.value.slice(1)) {
    const recall = ebisu.predictRecall(
      entry.model,
      Math.floor((Date.now() - new Date(entry.timestamp).getTime()) / 1000),
      true
    );

    if (recall < lowestRecall) {
      weakestEntry = entry;
      lowestRecall = recall;
    }
  }

  return { clip: weakestEntry.clip, recall: lowestRecall };
};

const createRound = (clip: Clip): Round | null => {
  const distractor = generateDistractor(clip.transcript);
  if (!distractor) {
    return null;
  }

  return {
    clip,
    distractor,
    options: shuffle([
      { label: clip.transcript, isCorrect: true },
      { label: distractor, isCorrect: false },
    ]),
  };
};

const pickNextClip = () => {
  const weakest = getLeastLikelyRememberedClip();
  if (
    weakest &&
    weakest.recall < REVIEW_THRESHOLD &&
    Math.random() < REVIEW_PROBABILITY
  ) {
    return weakest.clip;
  }

  return clips.value[Math.floor(Math.random() * clips.value.length)];
};

const replayAudio = async () => {
  const audio = audioRef.value;
  if (!audio) return;

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
  practiceEvents.value.push({
    eventType: "roundStarted",
    clip: toStoredClip(nextRound.clip),
    timestamp: new Date().toISOString(),
    distractor: nextRound.distractor,
  });
  persistEvents();

  phase.value = "ready";
  taskStartTime.value = Date.now();

  await nextTick();
  await replayAudio();
};

const updateLearningEntry = (clip: Clip, isCorrect: boolean) => {
  const now = new Date().toISOString();
  const existingIndex = learningEntries.value.findIndex(
    (entry) => entry.clip.filename === clip.filename
  );

  if (existingIndex === -1) {
    learningEntries.value.push({
      clip,
      model: ebisu.defaultModel(isCorrect ? 60 : 5),
      timestamp: now,
    });
    return;
  }

  const existingEntry = learningEntries.value[existingIndex];
  const elapsedTime = Math.max(
    1,
    Math.floor((Date.now() - new Date(existingEntry.timestamp).getTime()) / 1000)
  );

  learningEntries.value[existingIndex] = {
    ...existingEntry,
    model: ebisu.updateRecall(existingEntry.model, isCorrect ? 0.95 : 0.05, 1, elapsedTime),
    timestamp: now,
  };
};

const handleAnswer = async (option: AnswerOption, buttonIndex: number) => {
  if (!round.value) return;
  if (phase.value !== "ready" && phase.value !== "wrong") return;
  if (disabledButtonIndex.value === buttonIndex) return;

  if (phase.value === "ready") {
    practiceEvents.value.push({
      eventType: "answer",
      clip: toStoredClip(round.value.clip),
      timestamp: new Date().toISOString(),
      distractor: round.value.distractor,
      duration_ms: taskStartTime.value === null ? null : Date.now() - taskStartTime.value,
      selectedTranscript: option.label,
      isCorrect: option.isCorrect,
    });
    persistEvents();

    updateLearningEntry(round.value.clip, option.isCorrect);
    persistLearningEntries();
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
  if (phase.value !== "ready" && phase.value !== "wrong") return;
  if (answerOptions.value.length !== 2) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    void handleAnswer(answerOptions.value[0], 0);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    void handleAnswer(answerOptions.value[1], 1);
  }
};

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown);

  const transcriptText = await fetch("/transcriptAll.txt").then((response) => response.text());
  clips.value = parseTranscriptFile(transcriptText, MAX_WORDS);

  const clipsByFilename = new Map(clips.value.map((clip) => [clip.filename, clip]));
  learningEntries.value = storedLearningEntries.value
    .map((entry) => {
      const clip = clipsByFilename.get(entry.clip.filename);
      return clip
        ? {
          clip,
          model: entry.model,
          timestamp: entry.timestamp,
        }
        : null;
    })
    .filter((entry): entry is PracticeLearningEntry => entry !== null);

  await setNextRound();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <main class="px-4 py-6 sm:px-6">
    <section class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
      <div class="card w-full max-w-3xl border border-base-300 bg-base-100">
        <div class="card-body gap-6 p-6 sm:p-8">
          <div v-if="loadError" class="alert alert-error">
            <span>{{ loadError }}</span>
          </div>

          <div v-else-if="phase === 'loading'"
            class="flex min-h-64 items-center justify-center rounded-box border border-base-300 bg-base-200">
            <span class="loading loading-spinner loading-lg"></span>
          </div>

          <div v-else-if="round" class="space-y-4">
            <div class="card border border-base-300 bg-base-200">
              <div class="card-body gap-4 p-4">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div class="space-y-1">
                    <p class="font-medium">Audio</p>
                    <p class="text-sm text-base-content/70">
                      Listen first, then pick one of the two spellings.
                    </p>
                  </div>
                  <button class="btn btn-sm btn-outline" @click="replayAudio">Replay</button>
                </div>

                <audio ref="audioRef" :key="round.clip.filename" class="w-full" :src="round.clip.audioSrc"
                  preload="auto" controls autoplay />

                <div v-if="autoplayHint" class="alert alert-warning">
                  <span>{{ autoplayHint }}</span>
                </div>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <button v-for="(option, index) in answerOptions" :key="`${round.clip.filename}-${index}-${option.label}`"
                class="btn btn-2xl btn-outline h-auto flex-row items-center justify-between gap-3"
                :disabled="disabledButtonIndex === index" @click="handleAnswer(option, index)">
                <kbd class="kbd kbd-sm" v-if="index === 0">←</kbd>

                <span class="text-2xl">
                  {{ option.label }}
                </span>

                <kbd class="kbd kbd-sm" v-if="index !== 0">→</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
