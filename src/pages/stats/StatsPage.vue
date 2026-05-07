<script setup lang="ts">
import { computed, ref } from "vue";
import PracticeAccuracyChart from "./PracticeAccuracyChart.vue";
import PracticeDailyAccuracyChart from "./PracticeDailyAccuracyChart.vue";
import PracticeDailyVolumeChart from "./PracticeDailyVolumeChart.vue";
import PracticeStatsMatrix from "./PracticeStatsMatrix.vue";
import { usePracticeStatsPage } from "./usePracticeStatsPage";

const {
  accuracyTrials,
  exportTrackedData,
  importTrackedData,
  loadError,
  loading,
  stats,
  syncNotice,
  syncing,
} = usePracticeStatsPage();

const importInput = ref<HTMLInputElement | null>(null);

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

const openImportPicker = () => {
  importInput.value?.click();
};

const handleImportChange = async (event: Event) => {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const file = target.files?.[0];

  if (!file) {
    return;
  }

  await importTrackedData(file);
  target.value = "";
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

        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input
            ref="importInput"
            type="file"
            accept="application/json,.json"
            class="hidden"
            @change="handleImportChange"
          >

          <button
            class="btn btn-outline btn-sm w-full sm:w-auto"
            :disabled="syncing"
            @click="openImportPicker"
          >
            Import tracked data JSON
          </button>

          <button
            class="btn btn-outline btn-sm w-full sm:w-auto"
            :disabled="syncing"
            @click="exportTrackedData"
          >
            Export tracked data JSON
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="syncNotice"
      class="alert"
      :class="syncNotice.tone === 'success' ? 'alert-success' : 'alert-error'"
    >
      <span>{{ syncNotice.text }}</span>
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
      <PracticeDailyAccuracyChart :days="stats.dailyAccuracy" />

      <PracticeAccuracyChart :trials="accuracyTrials" />

      <section
        v-if="trackedConfusionAttempts > 0"
        class="space-y-4"
      >
        <PracticeStatsMatrix
          title="Letter confusions"
          :summary="stats.letter"
        />

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
