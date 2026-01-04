import { STORAGE_KEYS } from "@/lib/consts";
import type { BlockedSite, SiteStats, Settings } from "./types";

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
export type StorageShape = {
  [STORAGE_KEYS.BLOCKED_SITES]: BlockedSite[];
  [STORAGE_KEYS.STATS]: SiteStats[];
  [STORAGE_KEYS.SETTINGS]: Settings;
  [STORAGE_KEYS.SCHEMA_VERSION]: number;
};

export type StorageArea = "local" | "sync";

export type StoredValue<K extends StorageKey> = {
  found: boolean;
  value?: StorageShape[K];
};
