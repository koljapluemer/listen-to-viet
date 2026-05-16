import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { listAvailablePracticePairs, parsePracticeClips } from "../../features/practice-session-play/catalog";
import type { PracticePairOption } from "../../features/practice-session-play/model";
import type { PracticePairTarget } from "../../entities/practice-progress/stats";

type PairKind = "letter" | "tone";

const DEFAULT_KIND: PairKind = "letter";

const readQueryValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

export const usePairPracticePage = () => {
  const route = useRoute();
  const router = useRouter();
  const loading = ref(true);
  const loadError = ref("");
  const letterPairs = ref<PracticePairOption[]>([]);
  const tonePairs = ref<PracticePairOption[]>([]);

  const selectedKind = computed<PairKind>(() => {
    const kind = readQueryValue(route.query.kind);
    return kind === "tone" ? "tone" : DEFAULT_KIND;
  });

  const selectedPairValue = computed(() => {
    const left = readQueryValue(route.query.left);
    const right = readQueryValue(route.query.right);
    return left && right ? `${left}|${right}` : "";
  });

  const pairOptions = computed(() =>
    selectedKind.value === "tone" ? tonePairs.value : letterPairs.value
  );

  const selectedPairOption = computed(
    () => pairOptions.value.find((pairOption) => `${pairOption.leftKey}|${pairOption.rightKey}` === selectedPairValue.value) ?? null
  );

  const selectedPairTarget = computed<PracticePairTarget | null>(
    () => selectedPairOption.value?.pairTarget ?? null
  );

  const updateQuery = async (kind: PairKind, pairValue: string) => {
    const nextQuery = pairValue
      ? (() => {
          const [leftKey, rightKey] = pairValue.split("|");

          if (!leftKey || !rightKey) {
            return { kind };
          }

          return {
            kind,
            left: leftKey,
            right: rightKey,
          };
        })()
      : { kind };

    await router.replace({
      name: "pairPractice",
      query: nextQuery,
    });
  };

  const setSelectedKind = async (kind: PairKind) => {
    await updateQuery(kind, "");
  };

  const setSelectedPairValue = async (pairValue: string) => {
    await updateQuery(selectedKind.value, pairValue);
  };

  const loadPairOptions = async () => {
    loading.value = true;
    loadError.value = "";

    try {
      const transcriptResponse = await fetch("/transcriptAll.txt");

      if (!transcriptResponse.ok) {
        throw new Error("Could not load transcript data.");
      }

      const transcriptText = await transcriptResponse.text();
      const availablePairs = listAvailablePracticePairs(parsePracticeClips(transcriptText));

      letterPairs.value = availablePairs.letterPairs;
      tonePairs.value = availablePairs.tonePairs;
    } catch {
      loadError.value = "Could not load practice pairs.";
      letterPairs.value = [];
      tonePairs.value = [];
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    void loadPairOptions();
  });

  return {
    letterPairs,
    loadError,
    loading,
    pairOptions,
    selectedKind,
    selectedPairOption,
    selectedPairTarget,
    selectedPairValue,
    setSelectedKind,
    setSelectedPairValue,
    tonePairs,
  };
};
