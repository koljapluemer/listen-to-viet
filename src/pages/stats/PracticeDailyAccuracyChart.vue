<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { computed } from "vue";
import { Chart } from "vue-chartjs";
import {
  LineWithErrorBarsController,
  PointWithErrorBar,
  type IErrorBarYDataPoint,
} from "chartjs-chart-error-bars";
import type { DailyAccuracyPoint } from "../../entities/practice-progress/stats";
import {
  fillDailyRange,
  fullDateFormatter,
  getChartMinWidth,
  shortDateFormatter,
  toDate,
} from "./dailyChart";

ChartJS.register(
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  LineWithErrorBarsController,
  PointElement,
  PointWithErrorBar,
  Tooltip
);

const props = defineProps<{
  days: DailyAccuracyPoint[];
}>();

const completeDays = computed<DailyAccuracyPoint[]>(() =>
  fillDailyRange(props.days, (day) => ({
    accuracy: null,
    confidenceHigh95: null,
    confidenceLow95: null,
    correct: 0,
    day,
    trials: 0,
  }))
);

const chartLabels = computed(() =>
  completeDays.value.map((point) => {
    const date = toDate(point.day);
    return date ? shortDateFormatter.format(date) : point.day;
  })
);

const chartData = computed<ChartData<"lineWithErrorBars", IErrorBarYDataPoint[], string>>(() => ({
  labels: chartLabels.value,
  datasets: [
    {
      borderColor: "rgb(37, 99, 235)",
      data: completeDays.value.map((point) =>
        point.accuracy === null ||
        point.confidenceLow95 === null ||
        point.confidenceHigh95 === null
          ? ({ y: Number.NaN, yMax: Number.NaN, yMin: Number.NaN } satisfies IErrorBarYDataPoint)
          : ({
              y: point.accuracy * 100,
              yMax: point.confidenceHigh95 * 100,
              yMin: point.confidenceLow95 * 100,
            } satisfies IErrorBarYDataPoint)
      ),
      errorBarColor: "rgba(15, 23, 42, 0.95)",
      errorBarLineWidth: 2.5,
      errorBarWhiskerColor: "rgba(15, 23, 42, 0.95)",
      errorBarWhiskerLineWidth: 2.5,
      errorBarWhiskerSize: 10,
      label: "Accuracy",
      pointBackgroundColor: "rgb(37, 99, 235)",
      pointBorderColor: "rgb(29, 78, 216)",
      pointBorderWidth: 1.5,
      pointHoverRadius: 7,
      pointRadius: 6,
      pointRotation: 0,
      pointStyle: "line",
      showLine: false,
      spanGaps: false,
    },
  ],
}));

const chartOptions = computed<ChartOptions<"lineWithErrorBars">>(() => ({
  animation: false,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(item) {
          const point = completeDays.value[item.dataIndex];

          if (
            !point ||
            point.accuracy === null ||
            point.confidenceLow95 === null ||
            point.confidenceHigh95 === null
          ) {
            return "";
          }

          return [
            `Accuracy: ${(point.accuracy * 100).toFixed(1)}%`,
            `95% CI: ${(point.confidenceLow95 * 100).toFixed(1)}% to ${(point.confidenceHigh95 * 100).toFixed(1)}%`,
            `Trials: ${point.trials}`,
          ];
        },
        title(items) {
          const point = completeDays.value[items[0]?.dataIndex ?? -1];

          if (!point) {
            return "";
          }

          const date = toDate(point.day);
          return date ? fullDateFormatter.format(date) : point.day;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      offset: true,
    },
    y: {
      max: 100,
      min: 0,
      ticks: {
        callback(value) {
          return `${value}%`;
        },
        stepSize: 25,
      },
      grid: {
        color: "rgba(148, 163, 184, 0.2)",
      },
      title: {
        display: true,
        text: "Accuracy",
      },
    },
  },
}));

const chartMinWidth = computed(() => getChartMinWidth(completeDays.value.length));
</script>

<template>
  <section class="rounded-box border border-base-300 bg-base-100 p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">
        Accuracy per day
      </h2>
      <span class="text-sm text-base-content/70">
        {{ days.length }} active day{{ days.length === 1 ? "" : "s" }} over
        {{ completeDays.length }} day{{ completeDays.length === 1 ? "" : "s" }} · 95% Wilson CI
      </span>
    </div>

    <div
      v-if="completeDays.length"
      class="overflow-x-auto"
    >
      <div
        class="h-72"
        :style="{ minWidth: chartMinWidth }"
      >
        <Chart
          type="lineWithErrorBars"
          :data="chartData"
          :options="chartOptions"
        />
      </div>
    </div>

    <p
      v-else
      class="text-sm text-base-content/70"
    >
      No completed exercises yet.
    </p>
  </section>
</template>
