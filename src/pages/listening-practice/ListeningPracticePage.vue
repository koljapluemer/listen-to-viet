<script setup lang="ts">
import PracticeRoundChoices from "./PracticeRoundChoices.vue";
import { useListeningPracticeSession } from "./useListeningPracticeSession";

const {
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
} = useListeningPracticeSession();

void audioRef;
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <header class="border-b border-base-300 bg-base-100">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div class="flex items-center gap-3">
          <p class="text-base font-semibold">
            Listen to Viet
          </p>
          <div class="join">
            <RouterLink
              to="/"
              class="btn btn-sm join-item btn-active"
            >
              Practice
            </RouterLink>
            <RouterLink
              to="/stats"
              class="btn btn-sm join-item"
            >
              Stats
            </RouterLink>
          </div>
        </div>
        <button
          class="btn btn-sm btn-outline"
          @click="exportProgress"
        >
          Export progress
        </button>
      </div>
    </header>

    <main class="px-4 py-6 sm:px-6">
      <section class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <div class="card w-full max-w-3xl border border-base-300 bg-base-100">
          <div class="card-body gap-6 p-6 sm:p-8">
            <div
              v-if="loadError"
              class="alert alert-error"
            >
              <span>{{ loadError }}</span>
            </div>

            <div
              v-else-if="phase === 'loading'"
              class="flex min-h-64 items-center justify-center rounded-box border border-base-300 bg-base-200"
            >
              <span class="loading loading-spinner loading-lg" />
            </div>

            <div
              v-else-if="round"
              class="space-y-4"
            >
              <div class="card border border-base-300 bg-base-200">
                <div class="card-body gap-4 p-4">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div class="space-y-1">
                      <p class="font-medium">
                        Audio
                      </p>
                      <p class="text-sm text-base-content/70">
                        Listen first, then pick one of the two spellings.
                      </p>
                    </div>
                    <button
                      class="btn btn-sm btn-outline"
                      @click="replayAudio"
                    >
                      Replay
                    </button>
                  </div>

                  <audio
                    ref="audioRef"
                    :key="round.clip.filename"
                    class="w-full"
                    :src="round.clip.audioSrc"
                    preload="auto"
                    controls
                    autoplay
                  />

                  <div
                    v-if="autoplayHint"
                    class="alert alert-warning"
                  >
                    <span>{{ autoplayHint }}</span>
                  </div>
                </div>
              </div>

              <label
                class="ml-auto inline-flex items-center gap-2 text-xs text-base-content/60"
              >
                <span>mark</span>
                <input
                  v-model="highlightChange"
                  type="checkbox"
                  class="toggle toggle-xs"
                >
              </label>

              <PracticeRoundChoices
                :options="answerOptions"
                :clip-filename="round.clip.filename"
                :disabled-button-index="disabledButtonIndex"
                :highlight-change="highlightChange"
                :changed-character-index="changedCharacterIndex"
                :split-label="splitLabel"
                @select="handleAnswer"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
