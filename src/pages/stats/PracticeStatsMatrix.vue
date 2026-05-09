<script setup lang="ts">
import { computed } from "vue";
import { type MatrixCellStats, type MatrixSummary, type MatrixTopPair } from "../../entities/practice-progress/stats";

const props = defineProps<{
  title: string;
  summary: MatrixSummary;
  keys?: string[];
  formatKey?: (key: string) => string;
}>();

const MIN_RANDOM_ACCURACY = 0.5;
const SCIENTIFIC_COLOR_STOPS = [
  { position: 0, rgb: [0, 34, 78] },
  { position: 0.25, rgb: [52, 73, 107] },
  { position: 0.5, rgb: [103, 107, 112] },
  { position: 0.75, rgb: [168, 144, 92] },
  { position: 1, rgb: [253, 233, 69] },
] as const;

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
    row.cells.filter((cell) => cell.correctKey !== cell.distractorKey && cell.recentAccuracy !== null)
  )
);
const uniqueVisibleCells = computed(() => {
  const uniqueCells = new Map<string, MatrixCellStats>();

  visibleCells.value.forEach((cell) => {
    const pairKey = [cell.correctKey, cell.distractorKey].sort((left, right) => left.localeCompare(right)).join("|");

    if (!uniqueCells.has(pairKey)) {
      uniqueCells.set(pairKey, cell);
    }
  });

  return [...uniqueCells.values()];
});
const attempts = computed(() =>
  uniqueVisibleCells.value.reduce((total, cell) => total + cell.attempts, 0)
);
const recentAttempts = computed(() =>
  uniqueVisibleCells.value.reduce((total, cell) => total + cell.recentAttempts, 0)
);
const recentCorrect = computed(() =>
  uniqueVisibleCells.value.reduce((total, cell) => total + cell.recentCorrect, 0)
);
const distinctPairs = computed(() => uniqueVisibleCells.value.length);
const topPairs = computed<MatrixTopPair[]>(() =>
  [...uniqueVisibleCells.value]
    .filter((cell) => cell.attempts >= 3)
    .sort((left, right) => {
      if (left.recentAccuracy !== right.recentAccuracy) {
        return left.recentAccuracy! - right.recentAccuracy!;
      }

      if (left.recentAttempts !== right.recentAttempts) {
        return right.recentAttempts - left.recentAttempts;
      }

      return right.attempts - left.attempts;
    })
    .slice(0, 5)
    .map((cell) => ({
      label: `${formatKeyLabel(cell.correctKey)} vs ${formatKeyLabel(cell.distractorKey)}`,
      attempts: cell.attempts,
      correct: cell.correct,
      recentAttempts: cell.recentAttempts,
      recentCorrect: cell.recentCorrect,
      recentAccuracy: cell.recentAccuracy!,
    }))
);

const formatPercent = (value: number | null) => {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value * 100)}%`;
};

const formatKeyLabel = (key: string) => props.formatKey?.(key) ?? key;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mixChannel = (start: number, end: number, amount: number) =>
  Math.round(start + (end - start) * amount);

const getScientificColor = (value: number) => {
  const normalizedValue = clamp((value - MIN_RANDOM_ACCURACY) / (1 - MIN_RANDOM_ACCURACY), 0, 1);

  for (let index = 1; index < SCIENTIFIC_COLOR_STOPS.length; index += 1) {
    const start = SCIENTIFIC_COLOR_STOPS[index - 1];
    const end = SCIENTIFIC_COLOR_STOPS[index];

    if (normalizedValue <= end.position) {
      const range = end.position - start.position || 1;
      const amount = (normalizedValue - start.position) / range;

      return start.rgb.map((channel, channelIndex) =>
        mixChannel(channel, end.rgb[channelIndex], amount)
      ) as [number, number, number];
    }
  }

  return [...SCIENTIFIC_COLOR_STOPS[SCIENTIFIC_COLOR_STOPS.length - 1].rgb] as [number, number, number];
};

const getRelativeLuminance = ([red, green, blue]: [number, number, number]) =>
  (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

const getTooltip = (cell: MatrixCellStats) => {
  if (cell.recentAccuracy === null) {
    return "No tracked attempts yet";
  }

  return [
    `${formatKeyLabel(cell.correctKey)} vs ${formatKeyLabel(cell.distractorKey)}`,
    `Last ${cell.recentAttempts}: ${cell.recentCorrect}/${cell.recentAttempts} correct`,
    `Recent accuracy ${formatPercent(cell.recentAccuracy)}`,
    `Lifetime: ${cell.correct}/${cell.attempts} correct`,
    `Bayesian mean ${formatPercent(cell.posteriorAccuracy)}`,
  ].join("\n");
};

const getCellStyle = (cell: MatrixCellStats) => {
  if (cell.recentAccuracy === null || cell.correctKey === cell.distractorKey) {
    return {};
  }

  const [red, green, blue] = getScientificColor(cell.recentAccuracy);
  const alpha = Math.min(0.22 + Math.log(cell.attempts + 1) / 4, 0.82);
  const textColor = getRelativeLuminance([red, green, blue]) > 0.58 ? "rgb(17 24 39)" : "rgb(248 250 252)";

  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, ${alpha})`,
    borderColor: `rgba(${red}, ${green}, ${blue}, 0.58)`,
    color: textColor,
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
            Recent accuracy
          </div>
          <div class="stat-value text-xl">
            {{ formatPercent(recentAttempts ? recentCorrect / recentAttempts : null) }}
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
              <span class="text-sm font-semibold sm:text-base">{{ formatPercent(cell.recentAccuracy) }}</span>
              <span class="text-[11px] text-base-content/70">last {{ cell.recentAttempts }}</span>
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
            {{ formatPercent(pair.recentAccuracy) }} · last {{ pair.recentAttempts }}
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
