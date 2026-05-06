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

type ChartPalette = {
  axis: string;
  axisBorder: string;
  errorBar: string;
  grid: string;
  primary: string;
  surface: string;
  tooltipBackground: string;
};

const readThemeColor = (propertyName: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();

  if (!value) {
    throw new Error(`Missing Daisy theme variable: ${propertyName}`);
  }

  return value;
};

const chartPalette = computed<ChartPalette>(() => ({
  axis: readThemeColor("--color-base-content"),
  axisBorder: readThemeColor("--color-base-300"),
  errorBar: readThemeColor("--color-base-content"),
  grid: readThemeColor("--color-base-300"),
  primary: readThemeColor("--color-primary"),
  surface: readThemeColor("--color-base-100"),
  tooltipBackground: readThemeColor("--color-base-100"),
}));

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
      borderColor: chartPalette.value.primary,
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
      errorBarColor: chartPalette.value.errorBar,
      errorBarLineWidth: 2.5,
      errorBarWhiskerColor: chartPalette.value.errorBar,
      errorBarWhiskerLineWidth: 2.5,
      errorBarWhiskerSize: 10,
      label: "Accuracy",
      pointBackgroundColor: chartPalette.value.primary,
      pointBorderColor: chartPalette.value.surface,
      pointBorderWidth: 2.5,
      pointHoverRadius: 7,
      pointRadius: 15,
      pointRotation: 0,
      pointStyle: "circle",
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
      backgroundColor: chartPalette.value.tooltipBackground,
      bodyColor: chartPalette.value.axis,
      borderColor: chartPalette.value.axisBorder,
      borderWidth: 1,
      displayColors: false,
      titleColor: chartPalette.value.axis,
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
      border: {
        color: chartPalette.value.axisBorder,
      },
      grid: {
        display: false,
      },
      offset: true,
      ticks: {
        color: chartPalette.value.axis,
      },
    },
    y: {
      border: {
        color: chartPalette.value.axisBorder,
      },
      max: 100,
      min: 0,
      ticks: {
        callback(value) {
          return `${value}%`;
        },
        color: chartPalette.value.axis,
        stepSize: 25,
      },
      grid: {
        color: chartPalette.value.grid,
      },
      title: {
        color: chartPalette.value.axis,
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
