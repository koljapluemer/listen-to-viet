import { onMounted, ref } from "vue";
import {
  listPracticeEvents,
  readPracticeExportSnapshot,
} from "../../entities/practice-progress/storage";
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

  const exportTrackedData = async () => {
    const payload = await readPracticeExportSnapshot();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `viet-listening-progress-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  onMounted(() => {
    void loadStats();
  });

  return {
    accuracyTrials,
    exportTrackedData,
    loadError,
    loading,
    stats,
  };
};
