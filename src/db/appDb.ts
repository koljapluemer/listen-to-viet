import Dexie, { type Table } from "dexie";
import type { DbLearningRecordRow, DbPracticeEventRow } from "./types";

class ListenToVietDb extends Dexie {
  learningRecords!: Table<DbLearningRecordRow, string>;
  practiceEvents!: Table<DbPracticeEventRow, number>;

  constructor() {
    super("listenToViet");

    this.version(1).stores({
      learningRecords: "clipFilename",
      practiceEvents: "++id",
    });
  }
}

export const appDb = new ListenToVietDb();
