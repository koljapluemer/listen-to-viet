<script setup lang="ts">
import type { AnswerOption } from "./useListeningPracticeSession";

defineProps<{
  options: AnswerOption[];
  clipFilename: string;
  disabledButtonIndex: number | null;
  highlightChange: boolean;
  changedCharacterIndex: number;
  splitLabel: (label: string) => string[];
}>();

defineEmits<{
  select: [option: AnswerOption, index: number];
}>();
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <button
      v-for="(option, index) in options"
      :key="`${clipFilename}-${index}-${option.label}`"
      class="btn btn-2xl btn-outline h-auto flex-row items-center justify-between gap-3"
      :disabled="disabledButtonIndex === index"
      @click="$emit('select', option, index)"
    >
      <kbd
        v-if="index === 0"
        class="kbd kbd-sm"
      >←</kbd>

      <span class="text-2xl whitespace-pre-wrap">
        <span
          v-for="(character, characterIndex) in splitLabel(option.label)"
          :key="`${option.label}-${characterIndex}`"
          :class="{ 'text-marker': highlightChange && characterIndex === changedCharacterIndex }"
        >
          {{ character }}
        </span>
      </span>

      <kbd
        v-if="index !== 0"
        class="kbd kbd-sm"
      >→</kbd>
    </button>
  </div>
</template>
