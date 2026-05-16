<script setup lang="ts">
import { computed } from "vue";
import PracticeSessionPlayer from "../../features/practice-session-play/PracticeSessionPlayer.vue";
import { usePairPracticePage } from "./usePairPracticePage";

const {
  loadError,
  loading,
  pairOptions,
  selectedKind,
  selectedPairOption,
  selectedPairTarget,
  selectedPairValue,
  setSelectedKind,
  setSelectedPairValue,
} = usePairPracticePage();

const sessionKey = computed(() =>
  selectedPairOption.value
    ? `${selectedPairOption.value.kind}:${selectedPairOption.value.leftKey}|${selectedPairOption.value.rightKey}`
    : "pair-practice-empty"
);

const toneLabels: Record<string, string> = {
  ngang: "ngang | -",
  huyen: "huyền | `",
  sac: "sắc | /",
  hoi: "hỏi | ?",
  nga: "ngã | ~",
  nang: "nặng | .",
};

const formatPairLabel = (label: string) => {
  if (selectedKind.value !== "tone") {
    return label;
  }

  const [leftKey, rightKey] = label.split(" vs ");
  return `${toneLabels[leftKey] ?? leftKey} vs ${toneLabels[rightKey] ?? rightKey}`;
};

const handleKindChange = async (event: Event) => {
  const target = event.target;

  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  await setSelectedKind(target.value === "tone" ? "tone" : "letter");
};

const handlePairChange = async (event: Event) => {
  const target = event.target;

  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  await setSelectedPairValue(target.value);
};
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
    <div class="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold">
          Pair practice
        </h1>
        <p class="text-sm text-base-content/70">
          Practice one bidirectional vowel or tone pair only.
        </p>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">
            Pair type
          </span>
          <select
            class="select select-bordered mt-2 w-full"
            :value="selectedKind"
            :disabled="loading"
            @change="handleKindChange"
          >
            <option value="letter">
              Vowels
            </option>
            <option value="tone">
              Tones
            </option>
          </select>
        </label>

        <label class="form-control">
          <span class="label-text">
            Pair
          </span>
          <select
            class="select select-bordered mt-2 w-full"
            :value="selectedPairValue"
            :disabled="loading || !pairOptions.length"
            @change="handlePairChange"
          >
            <option value="">
              Select a pair
            </option>
            <option
              v-for="pairOption in pairOptions"
              :key="`${pairOption.kind}:${pairOption.leftKey}|${pairOption.rightKey}`"
              :value="`${pairOption.leftKey}|${pairOption.rightKey}`"
            >
              {{ formatPairLabel(pairOption.label) }}
            </option>
          </select>
        </label>
      </div>

      <div
        v-if="loadError"
        class="alert alert-error mt-4"
      >
        <span>{{ loadError }}</span>
      </div>

      <div
        v-else-if="loading"
        class="mt-4 flex min-h-32 items-center justify-center rounded-box border border-base-300 bg-base-200"
      >
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div
        v-else-if="!pairOptions.length"
        class="alert mt-4"
      >
        <span>No practice pairs are available for this type.</span>
      </div>

      <div
        v-else-if="!selectedPairOption"
        class="alert mt-4"
      >
        <span>Select a pair to start.</span>
      </div>
    </div>

    <PracticeSessionPlayer
      v-if="selectedPairTarget"
      :key="sessionKey"
      :config="{
        pairFilter: selectedPairTarget,
        metaMode: 'fixedPairBidirectional',
        metaPair: selectedPairTarget,
      }"
    />
  </section>
</template>
