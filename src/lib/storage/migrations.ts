import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../consts";
import type { BlockedSite, Schedule, SiteStats, StatsScope } from "./types";
import type { StorageArea, StorageKey, StorageShape, StoredValue } from "./shared";

const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
};

function normalizeSchedule(schedule: Schedule | undefined): {
  schedule: Schedule;
  changed: boolean;
} {
  if (!schedule) {
    return { schedule: DEFAULT_SCHEDULE, changed: true };
  }

  const nextSchedule = {
    enabled: schedule.enabled ?? false,
    days: Array.isArray(schedule.days) ? schedule.days : DEFAULT_SCHEDULE.days,
    start: typeof schedule.start === "string" ? schedule.start : DEFAULT_SCHEDULE.start,
    end: typeof schedule.end === "string" ? schedule.end : DEFAULT_SCHEDULE.end,
  };

  const changed =
    schedule.enabled !== nextSchedule.enabled ||
    schedule.start !== nextSchedule.start ||
    schedule.end !== nextSchedule.end ||
    schedule.days !== nextSchedule.days;

  return { schedule: nextSchedule, changed };
}

function normalizeBlockedSite(site: BlockedSite): {
  site: BlockedSite;
  changed: boolean;
} {
  let changed = false;
  const normalized = { ...site };

  if (normalized.strict) {
    if (normalized.unlockMethod !== "strict") {
      normalized.unlockMethod = "strict";
      changed = true;
    }
  }
  if ("strict" in normalized) {
    delete normalized.strict;
    changed = true;
  }

  const normalizedSchedule = normalizeSchedule(normalized.schedule);
  if (normalizedSchedule.changed) {
    normalized.schedule = normalizedSchedule.schedule;
    changed = true;
  }

  return { site: normalized, changed };
}

export function normalizeBlockedSites(
  sites: BlockedSite[] | undefined
): { sites: BlockedSite[]; changed: boolean } {
  if (!sites) return { sites: [], changed: false };
  if (!Array.isArray(sites)) return { sites: [], changed: true };
  let changed = false;
  const normalized: BlockedSite[] = [];
  for (const site of sites) {
    if (!site || typeof site !== "object") {
      changed = true;
      continue;
    }
    const result = normalizeBlockedSite(site);
    if (result.changed) changed = true;
    normalized.push(result.site);
  }
  return { sites: normalized, changed };
}

function normalizeScope(value: unknown): StatsScope {
  return value === "domain" ? "domain" : "site";
}

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeStats(
  stats: SiteStats[] | undefined
): { stats: SiteStats[]; changed: boolean } {
  if (!stats) return { stats: [], changed: false };
  if (!Array.isArray(stats)) return { stats: [], changed: true };

  let changed = false;
  const normalized: SiteStats[] = [];

  for (const entry of stats) {
    if (!entry || typeof entry !== "object") {
      changed = true;
      continue;
    }
    const scope = normalizeScope((entry as SiteStats).scope);
    const key =
      (entry as SiteStats).key ??
      (scope === "site" ? (entry as SiteStats).siteId : (entry as SiteStats).domain);

    if (!key || typeof key !== "string") {
      changed = true;
      continue;
    }

    const next: SiteStats = {
      scope,
      key,
      siteId: scope === "site" ? (entry as SiteStats).siteId ?? key : undefined,
      domain: scope === "domain" ? (entry as SiteStats).domain ?? key : undefined,
      visitCount: normalizeNumber((entry as SiteStats).visitCount),
      passedCount: normalizeNumber((entry as SiteStats).passedCount),
      timeSpentMs: normalizeNumber((entry as SiteStats).timeSpentMs),
      lastVisit: normalizeNumber((entry as SiteStats).lastVisit),
    };

    if (
      entry.scope !== next.scope ||
      entry.key !== next.key ||
      entry.siteId !== next.siteId ||
      entry.domain !== next.domain
    ) {
      changed = true;
    }

    normalized.push(next);
  }

  return { stats: normalized, changed };
}

export type MigrationHelpers = {
  getFromArea: <K extends StorageKey>(area: StorageArea, key: K) => Promise<StoredValue<K>>;
  setToArea: <K extends StorageKey>(
    area: StorageArea,
    key: K,
    value: StorageShape[K]
  ) => Promise<void>;
  shouldUseSync: () => boolean;
};

let migrationPromise: Promise<void> | null = null;

export async function ensureStorageUpgraded(
  helpers: MigrationHelpers
): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const areas: StorageArea[] = ["local"];
    if (helpers.shouldUseSync()) areas.push("sync");

    for (const area of areas) {
      const versionResult = await helpers.getFromArea(
        area,
        STORAGE_KEYS.SCHEMA_VERSION
      );
      const version =
        typeof versionResult.value === "number" ? versionResult.value : 1;

      if (version >= STORAGE_SCHEMA_VERSION) continue;

      const sitesResult = await helpers.getFromArea(
        area,
        STORAGE_KEYS.BLOCKED_SITES
      );
      const normalizedSites = normalizeBlockedSites(sitesResult.value);
      if (normalizedSites.changed) {
        await helpers.setToArea(
          area,
          STORAGE_KEYS.BLOCKED_SITES,
          normalizedSites.sites
        );
      }

      const statsResult = await helpers.getFromArea(area, STORAGE_KEYS.STATS);
      const normalizedStats = normalizeStats(statsResult.value);
      if (normalizedStats.changed) {
        await helpers.setToArea(
          area,
          STORAGE_KEYS.STATS,
          normalizedStats.stats
        );
      }

      await helpers.setToArea(
        area,
        STORAGE_KEYS.SCHEMA_VERSION,
        STORAGE_SCHEMA_VERSION
      );
    }
  })().catch((error) => {
    console.error("Storage migration failed:", error);
    migrationPromise = null;
  });

  return migrationPromise;
}
