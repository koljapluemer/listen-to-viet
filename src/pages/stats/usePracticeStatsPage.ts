import { onMounted, ref } from "vue";
import {
  importPracticeExportSnapshot,
  listPracticeEvents,
  readPracticeExportSnapshot,
} from "../../entities/practice-progress/storage";
import {
  getAccuracyTrialSeries,
  getPracticeStatsSnapshot,
  type AccuracyTrialPoint,
  type PracticeStatsSnapshot,
} from "../../entities/practice-progress/stats";

interface SyncNotice {
  tone: "success" | "error";
  text: string;
}

export const usePracticeStatsPage = () => {
  const loadError = ref("");
  const loading = ref(true);
  const syncing = ref(false);
  const accuracyTrials = ref<AccuracyTrialPoint[]>([]);
  const stats = ref<PracticeStatsSnapshot | null>(null);
  const syncNotice = ref<SyncNotice | null>(null);

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

  const importTrackedData = async (file: File) => {
    syncing.value = true;
    syncNotice.value = null;

    try {
      const fileContent = await file.text();
      const importResult = await importPracticeExportSnapshot(JSON.parse(fileContent) as unknown);
      await loadStats();

      syncNotice.value = {
        tone: "success",
        text:
          importResult.importedCount > 0
            ? `Imported ${importResult.importedCount} events. Skipped ${importResult.skippedCount}.`
            : `No new events. Skipped ${importResult.skippedCount} duplicates.`,
      };
    } catch (error) {
      syncNotice.value = {
        tone: "error",
        text: error instanceof Error ? error.message : "Could not import tracked data.",
      };
    } finally {
      syncing.value = false;
    }
  };

  onMounted(() => {
    void loadStats();
  });

  return {
    accuracyTrials,
    exportTrackedData,
    importTrackedData,
    loadError,
    loading,
    syncNotice,
    syncing,
    stats,
  };
};
