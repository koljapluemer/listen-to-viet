<script setup lang="ts">
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import type { DailyExercisePoint } from "../../entities/practice-progress/stats";
import {
  fillDailyRange,
  fullDateFormatter,
  getChartMinWidth,
  shortDateFormatter,
  toDate,
} from "./dailyChart";

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const props = defineProps<{
  days: DailyExercisePoint[];
}>();

const completeDays = computed<DailyExercisePoint[]>(() =>
  fillDailyRange(props.days, (day) => ({
    day,
    exercises: 0,
  }))
);

const chartLabels = computed(() =>
  completeDays.value.map((point) => {
    const date = toDate(point.day);
    return date ? shortDateFormatter.format(date) : point.day;
  })
);

const chartData = computed<ChartData<"bar">>(() => ({
  labels: chartLabels.value,
  datasets: [
    {
      backgroundColor: "rgba(59, 130, 246, 0.8)",
      borderColor: "rgb(37, 99, 235)",
      borderRadius: 6,
      borderSkipped: false,
      data: completeDays.value.map((point) => point.exercises),
      label: "Exercises",
      maxBarThickness: 36,
    },
  ],
}));

const chartOptions = computed<ChartOptions<"bar">>(() => ({
  animation: false,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        title(items) {
          const point = completeDays.value[items[0]?.dataIndex ?? -1];

          if (!point) {
            return "";
          }

          const date = toDate(point.day);
          return date ? fullDateFormatter.format(date) : point.day;
        },
        label(item) {
          const exercises = item.parsed.y ?? 0;
          return `${exercises} exercise${exercises === 1 ? "" : "s"}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
      },
      title: {
        display: true,
        text: "Exercises",
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
        Exercises per day
      </h2>
      <span class="text-sm text-base-content/70">
        {{ days.length }} active day{{ days.length === 1 ? "" : "s" }} over
        {{ completeDays.length }} day{{ completeDays.length === 1 ? "" : "s" }}
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
        <Bar
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
