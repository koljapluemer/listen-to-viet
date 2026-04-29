<script setup lang="ts">
import Exposer from "./components/Exposer.vue";

const EVENT_STORAGE_KEY = "viet-listening-events";
const LEARNING_STORAGE_KEY = "viet-listening-learning";

const handleDownload = () => {
  const learningModels = JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY) ?? "[]");
  const eventLog = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) ?? "[]");

  const payload = {
    exported_at: new Date().toISOString(),
    learning_models: learningModels,
    event_log: eventLog,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `viet-listening-progress-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <header class="border-b border-base-300 bg-base-100">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <p class="text-base font-semibold">Listen to Viet</p>
        <button class="btn btn-sm btn-outline" @click="handleDownload">Export progress</button>
      </div>
    </header>
    <Exposer />
  </div>
</template>
