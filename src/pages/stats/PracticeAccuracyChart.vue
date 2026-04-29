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
import { computed } from "vue";
import { Line } from "vue-chartjs";
import type { AccuracyTrialPoint } from "../../entities/practice-progress/stats";

ChartJS.register(Filler, Legend, LineElement, LinearScale, PointElement, Tooltip);

const props = defineProps<{
  trials: AccuracyTrialPoint[];
}>();

const chartData = computed<ChartData<"line">>(() => ({
  datasets: [
    {
      label: "Last 100 trials",
      data: props.trials.map((trial) => ({
        x: trial.trialNumber,
        y: 0.5,
      })),
      borderWidth: 0,
      pointBackgroundColor: props.trials.map((trial) =>
        trial.isCorrect ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"
      ),
      pointBorderColor: props.trials.map((trial) =>
        trial.isCorrect ? "rgb(22, 101, 52)" : "rgb(153, 27, 27)"
      ),
      pointHoverRadius: 5,
      pointRadius: 4,
      showLine: false,
      yAxisID: "markers",
    },
    {
      label: "Rolling 10",
      data: props.trials.map((trial) => ({
        x: trial.trialNumber,
        y: Math.round(trial.rolling10 * 1000) / 10,
      })),
      borderColor: "rgb(59, 130, 246)",
      borderWidth: 3,
      cubicInterpolationMode: "monotone",
      pointRadius: 0,
      tension: 0.3,
    },
    {
      label: "Rolling 100",
      data: props.trials.map((trial) => ({
        x: trial.trialNumber,
        y: Math.round(trial.rolling100 * 1000) / 10,
      })),
      borderColor: "rgb(245, 158, 11)",
      borderWidth: 3,
      cubicInterpolationMode: "monotone",
      pointRadius: 0,
      tension: 0.3,
    },
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
          if (item.datasetIndex === 0) {
            return props.trials[item.dataIndex]?.isCorrect ? "Correct" : "Incorrect";
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
    markers: {
      display: false,
      grid: {
        display: false,
      },
      max: 1,
      min: 0,
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
      <span class="text-sm text-base-content/70">
        Last {{ trials.length }} trials
      </span>
    </div>

    <div
      v-if="trials.length"
      class="h-80"
    >
      <Line
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
