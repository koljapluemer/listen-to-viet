<script setup lang="ts">
import PracticeRoundChoices from "./PracticeRoundChoices.vue";
import { useListeningPracticeSession } from "./useListeningPracticeSession";

const {
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
  <section class="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center">
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
                @ended="handleAudioEnded"
                @pause="handleAudioPause"
                @play="handleAudioPlay"
                @seeking="handleAudioSeek"
                @timeupdate="handleAudioTimeUpdate"
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
</template>
