import Dexie, { type Table } from "dexie";
import type { DbPracticeEventRow } from "./types";

class ListenToVietDb extends Dexie {
  practiceEvents!: Table<DbPracticeEventRow, number>;

  constructor() {
    super("listenToViet");

    this.version(1).stores({
      learningRecords: "clipFilename",
      practiceEvents: "++id",
    });

    this.version(2).stores({
      practiceEvents: "++id",
    });
  }
}

export const appDb = new ListenToVietDb();
