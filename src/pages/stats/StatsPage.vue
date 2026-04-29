<script setup lang="ts">
import { LETTER_COMPARISON_GROUPS } from "../../entities/listening-clip/model";
import PracticeAccuracyChart from "./PracticeAccuracyChart.vue";
import PracticeStatsMatrix from "./PracticeStatsMatrix.vue";
import { usePracticeStatsPage } from "./usePracticeStatsPage";

const { accuracyTrials, loadError, loading, stats } = usePracticeStatsPage();

const toneLabels: Record<string, string> = {
  ngang: "ngang · -",
  huyen: "huyền · `",
  sac: "sắc · /",
  hoi: "hỏi · ?",
  nga: "ngã · ~",
  nang: "nặng · .",
};
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <header class="border-b border-base-300 bg-base-100">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div class="flex items-center gap-3">
          <p class="text-base font-semibold">
            Listen to Viet
          </p>
          <div class="join">
            <RouterLink
              to="/"
              class="btn btn-sm join-item"
            >
              Practice
            </RouterLink>
            <RouterLink
              to="/stats"
              class="btn btn-sm join-item btn-active"
            >
              Stats
            </RouterLink>
          </div>
        </div>
      </div>
    </header>

    <main class="px-4 py-6 sm:px-6">
      <section class="mx-auto max-w-6xl space-y-6">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold">
            Stats
          </h1>
          <p class="text-sm text-base-content/70">
            Rows are the correct symbol. Columns are the distractor shown against it.
          </p>
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
          v-else-if="stats && stats.letter.attempts + stats.tone.attempts === 0"
          class="rounded-box border border-base-300 bg-base-100 p-6"
        >
          <h2 class="text-lg font-semibold">
            No tracked stats yet
          </h2>
          <p class="mt-2 text-sm text-base-content/70">
            Stats start with new attempts from this version onward. Play a few rounds to populate the matrices.
          </p>
        </div>

        <template v-else-if="stats">
          <PracticeAccuracyChart :trials="accuracyTrials" />

          <section class="space-y-4">
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
          </section>

          <PracticeStatsMatrix
            title="Tone confusions"
            :summary="stats.tone"
            :format-key="(key) => toneLabels[key] ?? key"
          />
        </template>
      </section>
    </main>
  </div>
</template>
