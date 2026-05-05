<script setup lang="ts">
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { computed, ref } from "vue";
import { Line } from "vue-chartjs";
import type { AccuracyTrialPoint } from "../../entities/practice-progress/stats";

ChartJS.register(Filler, Legend, LineElement, LinearScale, PointElement, Tooltip);

const RECENT_TRIAL_WINDOW = 100;
const MARKER_Y_VALUE = 0.5;

type AccuracyRange = "recent" | "all";

const props = defineProps<{
  trials: AccuracyTrialPoint[];
}>();

const range = ref<AccuracyRange>("recent");

const hasTrials = computed(() => props.trials.length > 0);
const isRecentRange = computed(() => range.value === "recent");

const visibleTrials = computed(() =>
  isRecentRange.value ? props.trials.slice(-RECENT_TRIAL_WINDOW) : props.trials
);

const firstVisibleTrialNumber = computed(() => visibleTrials.value[0]?.trialNumber);
const lastVisibleTrialNumber = computed(
  () => visibleTrials.value[visibleTrials.value.length - 1]?.trialNumber
);

const summaryLabel = computed(() =>
  isRecentRange.value
    ? `Last ${Math.min(props.trials.length, RECENT_TRIAL_WINDOW)} trials`
    : `${props.trials.length} total trials`
);

const chartKey = computed(
  () => `${range.value}-${firstVisibleTrialNumber.value ?? 0}-${lastVisibleTrialNumber.value ?? 0}`
);

const markerDataset = computed(() => ({
  label: "Individual trials",
  data: visibleTrials.value.map((trial) => ({
    x: trial.trialNumber,
    y: MARKER_Y_VALUE * 100,
  })),
  borderWidth: 0,
  pointBackgroundColor: visibleTrials.value.map((trial) =>
    trial.isCorrect ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"
  ),
  pointBorderColor: visibleTrials.value.map((trial) =>
    trial.isCorrect ? "rgb(22, 101, 52)" : "rgb(153, 27, 27)"
  ),
  pointHoverRadius: 5,
  pointRadius: 4,
  showLine: false,
}));

const toRollingDataset = (
  label: string,
  borderColor: string,
  getValue: (trial: AccuracyTrialPoint) => number
) => ({
  label,
  data: visibleTrials.value.map((trial) => ({
    x: trial.trialNumber,
    y: Math.round(getValue(trial) * 1000) / 10,
  })),
  borderColor,
  borderWidth: 3,
  cubicInterpolationMode: "monotone" as const,
  pointRadius: 0,
  tension: 0.3,
});

const chartData = computed<ChartData<"line">>(() => ({
  datasets: [
    ...(isRecentRange.value ? [markerDataset.value] : []),
    toRollingDataset("Rolling 10", "rgb(59, 130, 246)", (trial) => trial.rolling10),
    toRollingDataset("Rolling 100", "rgb(245, 158, 11)", (trial) => trial.rolling100),
    ...(!isRecentRange.value
      ? [toRollingDataset("Rolling 1000", "rgb(168, 85, 247)", (trial) => trial.rolling1000)]
      : []),
  ],
}));

const chartOptions = computed<ChartOptions<"line">>(() => ({
  animation: false,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: "nearest",
  },
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        usePointStyle: true,
      },
    },
    tooltip: {
      callbacks: {
        title(items) {
          return items[0] ? `Trial ${items[0].parsed.x}` : "";
        },
        label(item) {
          if (isRecentRange.value && item.dataset.label === "Individual trials") {
            return visibleTrials.value[item.dataIndex]?.isCorrect ? "Correct" : "Incorrect";
          }

          const value = item.parsed.y ?? 0;
          return `${item.dataset.label}: ${value.toFixed(1)}%`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      max: lastVisibleTrialNumber.value,
      min: firstVisibleTrialNumber.value,
      ticks: {
        maxRotation: 0,
      },
      title: {
        display: true,
        text: "Trial",
      },
      type: "linear",
    },
    y: {
      max: 100,
      min: 0,
      ticks: {
        callback(value) {
          return `${value}%`;
        },
      },
      title: {
        display: true,
        text: "Accuracy",
      },
    },
  },
}));
</script>

<template>
  <section class="rounded-box border border-base-300 bg-base-100 p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">
        Accuracy over time
      </h2>
      <div class="flex items-center gap-3">
        <span class="text-sm text-base-content/70">
          {{ summaryLabel }}
        </span>
        <div
          v-if="hasTrials"
          class="join"
        >
          <button
            type="button"
            class="btn btn-sm join-item"
            :class="{ 'btn-active': isRecentRange }"
            @click="range = 'recent'"
          >
            Last 100
          </button>
          <button
            type="button"
            class="btn btn-sm join-item"
            :class="{ 'btn-active': range === 'all' }"
            @click="range = 'all'"
          >
            All-time
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="hasTrials"
      class="h-80"
    >
      <Line
        :key="chartKey"
        :data="chartData"
        :options="chartOptions"
      />
    </div>

    <p
      v-else
      class="text-sm text-base-content/70"
    >
      No answer history yet.
    </p>
  </section>
</template>
