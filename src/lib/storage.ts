import { STORAGE_KEYS } from "./consts";
import { ensureStorageUpgraded, normalizeBlockedSites, normalizeStats } from "./storage/migrations";
import type {
  BlockedSite,
  Settings,
  SiteStats,
  Schedule,
  PatternRule,
  StatsScope,
} from "./storage/types";
import type { StorageArea, StorageKey, StorageShape, StoredValue } from "./storage/shared";

export type { PatternRule, BlockedSite, Schedule, SiteStats, Settings, StatsScope };
export type { UnlockMethod, ChallengeSettingsMap } from "@/components/challenges";
export { normalizeStats } from "./storage/migrations";

export const defaultSettings: Settings = {
  statsEnabled: true,
  requireChallengeForChanges: true,
};

let syncBlockedForSession = false;

function hasOwnKey(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

async function getFromArea<K extends StorageKey>(
  area: StorageArea,
  key: K,
): Promise<StoredValue<K>> {
  const result = await browser.storage[area].get(key);
  return {
    found: hasOwnKey(result, key),
    value: result[key] as StorageShape[K] | undefined,
  };
}

function shouldUseSync(): boolean {
  return isSyncAvailable() && !syncBlockedForSession;
}

async function getFromSync<K extends StorageKey>(key: K): Promise<StoredValue<K>> {
  if (!shouldUseSync()) return { found: false };
  try {
    return await getFromArea("sync", key);
  } catch (error) {
    syncBlockedForSession = true;
    console.warn("Sync storage failed, falling back to local:", error);
    return { found: false };
  }
}

async function setToArea<K extends StorageKey>(
  area: StorageArea,
  key: K,
  value: StorageShape[K],
): Promise<void> {
  const payload = { [key]: value } as Record<K, StorageShape[K]>;
  await browser.storage[area].set(payload);
}

async function setWithFallback<K extends StorageKey>(
  key: K,
  value: StorageShape[K],
): Promise<void> {
  try {
    if (!shouldUseSync()) {
      await setToArea("local", key, value);
      return;
    }
    if (browser.storage?.sync) {
      await setToArea("sync", key, value);
      return;
    }
    throw new Error("Sync storage unavailable");
  } catch (error) {
    syncBlockedForSession = true;
    console.warn("Sync storage failed, falling back to local:", error);
    await setToArea("local", key, value);
  }
}

export function isSyncAvailable(): boolean {
  return typeof browser !== "undefined" && !!browser.storage?.sync;
}

const migrationHelpers = {
  getFromArea,
  setToArea,
  shouldUseSync,
};

async function getWithFallback<K extends StorageKey>(key: K): Promise<StorageShape[K] | undefined> {
  const syncResult = await getFromSync(key);
  if (syncResult.found) return syncResult.value;

  const localResult = await getFromArea("local", key);
  if (localResult.found && localResult.value !== undefined && shouldUseSync()) {
    void setToArea("sync", key, localResult.value).catch((error) => {
      syncBlockedForSession = true;
      console.warn("Sync storage failed, falling back to local:", error);
    });
  }

  return localResult.value;
}
export async function getBlockedSites(): Promise<BlockedSite[]> {
  await ensureStorageUpgraded(migrationHelpers);
  const stored = await getWithFallback(STORAGE_KEYS.BLOCKED_SITES);
  const normalized = normalizeBlockedSites(stored);
  if (normalized.changed) {
    void setWithFallback(STORAGE_KEYS.BLOCKED_SITES, normalized.sites);
  }
  return normalized.sites;
}

export async function saveBlockedSites(sites: BlockedSite[]): Promise<void> {
  await setWithFallback(STORAGE_KEYS.BLOCKED_SITES, sites);
}

export async function addBlockedSite(
  site: Omit<BlockedSite, "id" | "createdAt">,
): Promise<BlockedSite> {
  const sites = await getBlockedSites();
  const newSite: BlockedSite = {
    ...site,
    id: Math.random().toString(36).substring(2, 10),
    createdAt: Date.now(),
  };
  sites.push(newSite);
  await saveBlockedSites(sites);
  return newSite;
}

export async function updateBlockedSite(id: string, updates: Partial<BlockedSite>): Promise<void> {
  const sites = await getBlockedSites();
  const index = sites.findIndex((s) => s.id === id);
  if (index !== -1) {
    sites[index] = { ...sites[index], ...updates };
    await saveBlockedSites(sites);
  }
}

export async function getStats(): Promise<SiteStats[]> {
  await ensureStorageUpgraded(migrationHelpers);
  const result = await getFromArea("local", STORAGE_KEYS.STATS);
  const normalized = normalizeStats(result.value);
  if (normalized.changed) {
    await setToArea("local", STORAGE_KEYS.STATS, normalized.stats);
  }
  return normalized.stats;
}

export async function getSettings(): Promise<Settings> {
  await ensureStorageUpgraded(migrationHelpers);
  const stored = await getWithFallback(STORAGE_KEYS.SETTINGS);
  return { ...defaultSettings, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setWithFallback(STORAGE_KEYS.SETTINGS, settings);
}

export function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    const normalizedPattern = pattern
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "");

    if (normalizedPattern.includes("/")) {
      const slashIndex = normalizedPattern.indexOf("/");
      const hostPattern = normalizedPattern.slice(0, slashIndex);
      const pathPattern = normalizedPattern.slice(slashIndex);
      const normalizedPath = pathname.toLowerCase();
      const normalizedPathPattern = pathPattern.toLowerCase();

      const normalizedHost = hostname.toLowerCase().replace(/^www\./, "");
      let hostMatches = false;

      if (hostPattern.startsWith("*.")) {
        const domain = hostPattern.slice(2);
        hostMatches = normalizedHost === domain || normalizedHost.endsWith("." + domain);
      } else if (hostPattern.includes("*")) {
        const regexPattern = hostPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`, "i");
        hostMatches = regex.test(normalizedHost) || regex.test(hostname.toLowerCase());
      } else {
        hostMatches =
          normalizedHost === hostPattern ||
          hostname.toLowerCase() === hostPattern ||
          hostname.toLowerCase() === "www." + hostPattern;
      }

      if (!hostMatches) return false;

      if (normalizedPathPattern.includes("*")) {
        const regexPattern = normalizedPathPattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`, "i");
        return regex.test(normalizedPath);
      }

      const cleanPattern = normalizedPathPattern.replace(/\/$/, "");
      const cleanPath = normalizedPath.replace(/\/$/, "");
      return cleanPath === cleanPattern || cleanPath.startsWith(cleanPattern + "/");
    }

    const normalizedHost = hostname.toLowerCase().replace(/^www\./, "");
    if (normalizedPattern.startsWith("*.")) {
      const domain = normalizedPattern.slice(2);
      return normalizedHost === domain || normalizedHost.endsWith("." + domain);
    }

    if (normalizedPattern.includes("*")) {
      const regexPattern = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      const regex = new RegExp(`^${regexPattern}$`, "i");
      return regex.test(normalizedHost) || regex.test(hostname.toLowerCase());
    }

    return (
      normalizedHost === normalizedPattern ||
      hostname.toLowerCase() === normalizedPattern ||
      hostname.toLowerCase() === "www." + normalizedPattern
    );
  } catch {
    return false;
  }
}

export function isInSchedule(schedule: Schedule): boolean {
  if (!schedule.enabled) return true;

  const now = new Date();
  const day = now.getDay(); // 0-6 Sun-Sat

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = schedule.start.split(":").map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = schedule.end.split(":").map(Number);
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) {
    return schedule.days.includes(day);
  }

  if (startMinutes < endMinutes) {
    if (!schedule.days.includes(day)) return false;
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  const prevDay = (day + 6) % 7;
  const inCurrentDayWindow = schedule.days.includes(day) && currentMinutes >= startMinutes;
  const inPrevDayWindow = schedule.days.includes(prevDay) && currentMinutes <= endMinutes;

  return inCurrentDayWindow || inPrevDayWindow;
}

export function urlMatchesSiteRules(url: string, site: BlockedSite): boolean {
  if (!site.enabled) return false;

  // Check schedule if enabled
  if (site.schedule?.enabled) {
    if (!isInSchedule(site.schedule)) {
      return false; // Outside of blocked schedule
    }
  }

  let isBlocked = false;

  // Process rules in order - allow rules can override block rules
  for (const rule of site.rules) {
    if (urlMatchesPattern(url, rule.pattern)) {
      if (rule.allow) {
        return false;
      } else {
        isBlocked = true;
      }
    }
  }

  return isBlocked;
}

export async function findMatchingBlockedSite(url: string): Promise<BlockedSite | null> {
  const sites = await getBlockedSites();
  return sites.find((site) => urlMatchesSiteRules(url, site)) || null;
}
