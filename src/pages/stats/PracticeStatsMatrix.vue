<script setup lang="ts">
import { computed } from "vue";
import {
  calculatePosteriorAccuracy,
  type MatrixCellStats,
  type MatrixSummary,
  type MatrixTopPair,
} from "../../entities/practice-progress/stats";

const props = defineProps<{
  title: string;
  summary: MatrixSummary;
  keys?: string[];
  formatKey?: (key: string) => string;
}>();

const visibleKeys = computed(() => props.keys ?? props.summary.rows.map((row) => row.key));
const visibleRows = computed(() =>
  props.summary.rows
    .filter((row) => visibleKeys.value.includes(row.key))
    .map((row) => ({
      key: row.key,
      cells: row.cells.filter((cell) => visibleKeys.value.includes(cell.distractorKey)),
    }))
);
const columnKeys = computed(() => visibleRows.value[0]?.cells.map((cell) => cell.distractorKey) ?? []);
const visibleCells = computed(() =>
  visibleRows.value.flatMap((row) =>
    row.cells.filter((cell) => cell.correctKey !== cell.distractorKey && cell.posteriorAccuracy !== null)
  )
);
const attempts = computed(() =>
  visibleCells.value.reduce((total, cell) => total + cell.attempts, 0)
);
const correct = computed(() => visibleCells.value.reduce((total, cell) => total + cell.correct, 0));
const posteriorAccuracy = computed(() =>
  attempts.value ? calculatePosteriorAccuracy(correct.value, attempts.value) : null
);
const distinctPairs = computed(() => visibleCells.value.length);
const topPairs = computed<MatrixTopPair[]>(() =>
  [...visibleCells.value]
    .filter((cell) => cell.attempts >= 3)
    .sort((left, right) => {
      if (left.posteriorAccuracy !== right.posteriorAccuracy) {
        return left.posteriorAccuracy! - right.posteriorAccuracy!;
      }

      return right.attempts - left.attempts;
    })
    .slice(0, 5)
    .map((cell) => ({
      label: `${formatKeyLabel(cell.correctKey)} -> ${formatKeyLabel(cell.distractorKey)}`,
      attempts: cell.attempts,
      correct: cell.correct,
      posteriorAccuracy: cell.posteriorAccuracy!,
    }))
);

const formatPercent = (value: number | null) => {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value * 100)}%`;
};

const formatKeyLabel = (key: string) => props.formatKey?.(key) ?? key;

const getTooltip = (cell: MatrixCellStats) => {
  if (cell.posteriorAccuracy === null) {
    return "No tracked attempts yet";
  }

  return [
    `${formatKeyLabel(cell.correctKey)} vs ${formatKeyLabel(cell.distractorKey)}`,
    `${cell.correct}/${cell.attempts} correct`,
    `Bayesian mean ${formatPercent(cell.posteriorAccuracy)}`,
  ].join("\n");
};

const getCellStyle = (cell: MatrixCellStats) => {
  if (cell.posteriorAccuracy === null || cell.correctKey === cell.distractorKey) {
    return {};
  }

  const hue = cell.posteriorAccuracy * 120;
  const alpha = Math.min(0.22 + Math.log(cell.attempts + 1) / 4, 0.82);

  return {
    backgroundColor: `hsla(${hue}, 72%, 72%, ${alpha})`,
    borderColor: `hsla(${hue}, 72%, 30%, 0.3)`,
  };
};
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">
          {{ title }}
        </h2>
      </div>
      <div class="stats stats-vertical border border-base-300 bg-base-100 shadow-sm sm:stats-horizontal">
        <div class="stat px-4 py-3">
          <div class="stat-title text-xs">
            Accuracy
          </div>
          <div class="stat-value text-xl">
            {{ formatPercent(posteriorAccuracy) }}
          </div>
        </div>
        <div class="stat px-4 py-3">
          <div class="stat-title text-xs">
            Attempts
          </div>
          <div class="stat-value text-xl">
            {{ attempts }}
          </div>
        </div>
        <div class="stat px-4 py-3">
          <div class="stat-title text-xs">
            Pairs
          </div>
          <div class="stat-value text-xl">
            {{ distinctPairs }}
          </div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto overflow-y-hidden rounded-box border border-base-300 bg-base-100 p-3">
      <div
        class="grid w-fit min-w-full gap-2 text-center text-xs sm:text-sm"
        :style="{ gridTemplateColumns: `max-content repeat(${columnKeys.length}, minmax(4.5rem, 1fr))` }"
      >
        <div class="sticky left-0 z-10 rounded-box bg-base-100 p-2" />

        <div
          v-for="columnKey in columnKeys"
          :key="columnKey"
          class="flex items-center justify-center rounded-box bg-base-200 p-2 font-medium"
        >
          {{ formatKeyLabel(columnKey) }}
        </div>

        <template
          v-for="row in visibleRows"
          :key="row.key"
        >
          <div class="sticky left-0 z-10 flex items-center rounded-box bg-base-200 p-2 font-medium">
            {{ formatKeyLabel(row.key) }}
          </div>

          <div
            v-for="cell in row.cells"
            :key="`${cell.correctKey}-${cell.distractorKey}`"
            class="tooltip tooltip-bottom min-h-20 rounded-box border p-2"
            :class="{
              'border-base-300 bg-base-200/60 text-base-content/40': cell.correctKey === cell.distractorKey,
              'border-base-300 bg-base-100': cell.correctKey !== cell.distractorKey,
            }"
            :data-tip="getTooltip(cell)"
            :style="getCellStyle(cell)"
          >
            <div class="flex h-full flex-col items-center justify-center gap-1">
              <span class="text-sm font-semibold sm:text-base">{{ formatPercent(cell.posteriorAccuracy) }}</span>
              <span class="text-[11px] text-base-content/70">n={{ cell.attempts }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="rounded-box border border-base-300 bg-base-100 p-4">
      <h3 class="text-sm font-semibold">
        Hardest pairs
      </h3>
      <div
        v-if="topPairs.length"
        class="mt-3 grid gap-2"
      >
        <div
          v-for="pair in topPairs"
          :key="pair.label"
          class="flex items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm"
        >
          <span>{{ pair.label }}</span>
          <span class="text-base-content/70">
            {{ formatPercent(pair.posteriorAccuracy) }} · n={{ pair.attempts }}
          </span>
        </div>
      </div>
      <p
        v-else
        class="mt-3 text-sm text-base-content/70"
      >
        More tracked attempts are needed before pair rankings become useful.
      </p>
    </div>
  </section>
</template>
