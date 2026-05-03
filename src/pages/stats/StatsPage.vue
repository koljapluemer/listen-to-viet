<script setup lang="ts">
import { computed } from "vue";
import { LETTER_COMPARISON_GROUPS } from "../../entities/listening-clip/model";
import PracticeAccuracyChart from "./PracticeAccuracyChart.vue";
import PracticeDailyVolumeChart from "./PracticeDailyVolumeChart.vue";
import PracticeStatsMatrix from "./PracticeStatsMatrix.vue";
import { usePracticeStatsPage } from "./usePracticeStatsPage";

const { accuracyTrials, exportTrackedData, loadError, loading, stats } = usePracticeStatsPage();

const toneLabels: Record<string, string> = {
  ngang: "ngang | -",
  huyen: "huyền | `",
  sac: "sắc | /",
  hoi: "hỏi | ?",
  nga: "ngã | ~",
  nang: "nặng | .",
};

const trackedConfusionAttempts = computed(
  () => (stats.value ? stats.value.letter.attempts + stats.value.tone.attempts : 0)
);

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};
</script>

<template>
  <section class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
    <div class="space-y-2">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold">
            Stats
          </h1>
        </div>

        <button
          class="btn btn-outline btn-sm w-full sm:w-auto"
          @click="exportTrackedData"
        >
          Export tracked data JSON
        </button>
      </div>
    </div>

    <div
      v-if="loadError"
      class="alert alert-error"
    >
      <span>{{ loadError }}</span>
    </div>

    <div
      v-else-if="loading"
      class="flex min-h-64 items-center justify-center rounded-box border border-base-300 bg-base-100"
    >
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div
      v-else-if="stats && stats.overview.totalExercises === 0"
      class="rounded-box border border-base-300 bg-base-100 p-6"
    >
      <h2 class="text-lg font-semibold">
        No tracked stats yet
      </h2>
    </div>

    <template v-else-if="stats">
      <section class="rounded-box border border-base-300 bg-base-100 p-4">
        <div class="stats stats-vertical w-full border border-base-300 bg-base-200 shadow-sm sm:stats-horizontal">
          <div class="stat">
            <div class="stat-title">
              Exercises completed
            </div>
            <div class="stat-value text-primary">
              {{ stats.overview.totalExercises }}
            </div>
          </div>

          <div class="stat">
            <div class="stat-title">
              Audio listening time
            </div>
            <div class="stat-value text-secondary">
              {{ formatDuration(stats.overview.totalListeningMs) }}
            </div>
          </div>
        </div>
      </section>

      <PracticeDailyVolumeChart :days="stats.dailyExercises" />

      <PracticeAccuracyChart :trials="accuracyTrials" />

      <section
        v-if="trackedConfusionAttempts > 0"
        class="space-y-4"
      >
        <h2 class="text-xl font-semibold">
          Letter confusions
        </h2>

        <div class="grid gap-6 xl:grid-cols-2">
          <PracticeStatsMatrix
            v-for="group in LETTER_COMPARISON_GROUPS"
            :key="group.join('-')"
            :title="group.join(' / ')"
            :summary="stats.letter"
            :keys="[...group]"
          />
        </div>

        <PracticeStatsMatrix
          title="Tone confusions"
          :summary="stats.tone"
          :format-key="(key) => toneLabels[key] ?? key"
        />
      </section>

      <section
        v-else
        class="rounded-box border border-base-300 bg-base-100 p-6"
      >
        <h2 class="text-lg font-semibold">
          Confusion stats need newer attempts
        </h2>
        <p class="mt-2 text-sm text-base-content/70">
          Exercise totals and listening time are available, but the confusion matrices only
          populate from analytics-enabled attempts.
        </p>
      </section>
    </template>
  </section>
</template>
