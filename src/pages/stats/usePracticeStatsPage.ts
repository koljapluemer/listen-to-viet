import { onMounted, ref } from "vue";
import { listPracticeEvents } from "../../entities/practice-progress/storage";
import {
  getAccuracyTrialSeries,
  getPracticeStatsSnapshot,
  type AccuracyTrialPoint,
  type PracticeStatsSnapshot,
} from "../../entities/practice-progress/stats";

export const usePracticeStatsPage = () => {
  const loadError = ref("");
  const loading = ref(true);
  const accuracyTrials = ref<AccuracyTrialPoint[]>([]);
  const stats = ref<PracticeStatsSnapshot | null>(null);

  const loadStats = async () => {
    loading.value = true;
    loadError.value = "";

    try {
      const practiceEvents = await listPracticeEvents();
      stats.value = getPracticeStatsSnapshot(practiceEvents);
      accuracyTrials.value = getAccuracyTrialSeries(practiceEvents);
    } catch {
      loadError.value = "Could not load stats.";
      accuracyTrials.value = [];
      stats.value = null;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    void loadStats();
  });

  return {
    accuracyTrials,
    loadError,
    loading,
    stats,
  };
};
