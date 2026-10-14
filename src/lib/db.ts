import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Asset, Boom, BoomLink, HomeView, Moment, Space } from "@/lib/model";

export const DATABASE_NAME = "boom-moment";
export const DATABASE_VERSION = 2;

interface MetaRow {
  key: string;
  value: string;
}

export interface BoomDB extends DBSchema {
  moments: {
    key: string;
    value: Moment;
    indexes: { "by-updated": string; "by-space": string };
  };
  spaces: {
    key: string;
    value: Space;
    indexes: { "by-parent": string };
  };
  boomLinks: {
    key: string;
    value: BoomLink;
    indexes: { "by-a": string; "by-b": string };
  };
  booms: {
    key: string;
    value: Boom;
    indexes: { "by-source": string; "by-result": string };
  };
  assets: {
    key: string;
    value: Asset;
  };
  meta: {
    key: string;
    value: MetaRow;
  };
}

export class StorageQuotaError extends Error {
  constructor() {
    super("storage quota exceeded");
    this.name = "StorageQuotaError";
  }
}

let databasePromise: Promise<IDBPDatabase<BoomDB>> | null = null;

export function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDB<BoomDB>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const moments = database.createObjectStore("moments", { keyPath: "id" });
          moments.createIndex("by-updated", "updatedAt");
          moments.createIndex("by-space", "spaceId");

          const spaces = database.createObjectStore("spaces", { keyPath: "id" });
          spaces.createIndex("by-parent", "parentId");

          const links = database.createObjectStore("boomLinks", { keyPath: "id" });
          links.createIndex("by-a", "aId");
          links.createIndex("by-b", "bId");

          database.createObjectStore("assets", { keyPath: "id" });
          database.createObjectStore("meta", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          const booms = database.createObjectStore("booms", { keyPath: "id" });
          booms.createIndex("by-source", "sourceMomentIds", { multiEntry: true });
          booms.createIndex("by-result", "resultMomentId");
        }
      },
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export function asStorageError(error: unknown) {
  if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
    return new StorageQuotaError();
  }
  if (error instanceof StorageQuotaError) {
    return error;
  }
  return error;
}

export async function readHomeView(): Promise<HomeView> {
  const database = await getDatabase();
  const row = await database.get("meta", "homeView");
  return row?.value === "list" ? "list" : "cards";
}

export async function writeHomeView(view: HomeView) {
  const database = await getDatabase();
  await database.put("meta", { key: "homeView", value: view });
}
