import type {
  UnlockMethod,
  ChallengeSettingsMap,
} from "@/components/challenges";

export type { UnlockMethod, ChallengeSettingsMap };

export interface PatternRule {
  pattern: string; // URL pattern (e.g., "twitter.com", "*.reddit.com", "x.com/messages")
  allow: boolean; // true = allow (whitelist), false = block
}

export interface BlockedSite {
  id: string;
  name: string; // Display name for the rule set
  rules: PatternRule[]; // Multiple patterns with allow/deny
  unlockMethod: UnlockMethod;
  challengeSettings: ChallengeSettingsMap[UnlockMethod]; // Settings for the challenge
  autoRelockAfter: number | null; // minutes before re-locking, null = no auto-relock
  enabled: boolean;
  createdAt: number;
  strict?: boolean;
  schedule?: Schedule;
}

export interface Schedule {
  enabled: boolean;
  days: number[];
  start: string;
  end: string;
}

export interface SiteStats {
  siteId: string;
  visitCount: number;
  passedCount: number;
  timeSpentMs: number; // time spent on site after unlocking
  lastVisit: number;
}

export interface Settings {
  statsEnabled: boolean;
}

import { DEFAULT_AUTO_RELOCK, STORAGE_KEYS } from "./consts";

export const defaultSettings: Settings = {
  statsEnabled: true,
};

// Storage keys
/*
const STORAGE_KEYS = {
  BLOCKED_SITES: "blockedSites",
  STATS: "siteStats",
  SETTINGS: "settings",
} as const;
*/

// Generate a short random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Generate annoying text to type
export function generateAnnoyingText(): string {
  return crypto.randomUUID();
}

const storage = {
  get: async (keys: string | string[]) => {
    try {
      if (browser.storage.sync) {
        return await browser.storage.sync.get(keys);
      }
      throw new Error("Sync storage unavailable");
    } catch (e) {
      console.warn("Sync storage failed, falling back to local:", e);
      return await browser.storage.local.get(keys);
    }
  },
  set: async (items: Record<string, any>) => {
    try {
      if (browser.storage.sync) {
        return await browser.storage.sync.set(items);
      }
      throw new Error("Sync storage unavailable");
    } catch (e) {
      console.warn("Sync storage failed, falling back to local:", e);
      return await browser.storage.local.set(items);
    }
  }
};
// Singleton migration promise
let migrationPromise: Promise<void> | null = null;

async function migrateToSync() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      const localData = (await browser.storage.local.get([
        STORAGE_KEYS.BLOCKED_SITES,
        STORAGE_KEYS.SETTINGS,
      ])) as Record<string, any>;

      const syncData = (await storage.get([
        STORAGE_KEYS.BLOCKED_SITES,
        STORAGE_KEYS.SETTINGS,
      ])) as Record<string, any>;

      // If local data exists but sync data is empty, migrate
      if (localData[STORAGE_KEYS.BLOCKED_SITES] && !syncData[STORAGE_KEYS.BLOCKED_SITES]) {
        await storage.set({
          [STORAGE_KEYS.BLOCKED_SITES]: localData[STORAGE_KEYS.BLOCKED_SITES],
        });
      }

      if (localData[STORAGE_KEYS.SETTINGS] && !syncData[STORAGE_KEYS.SETTINGS]) {
        await storage.set({
          [STORAGE_KEYS.SETTINGS]: localData[STORAGE_KEYS.SETTINGS],
        });
      }
    } catch (error) {
      console.error("Migration failed:", error);
    }
  })();

  return migrationPromise;
}

// Call migration once on module load
migrateToSync();
export async function getBlockedSites(): Promise<BlockedSite[]> {
  const result = (await storage.get(
    STORAGE_KEYS.BLOCKED_SITES
  )) as Record<string, BlockedSite[] | undefined>;
  return result[STORAGE_KEYS.BLOCKED_SITES] ?? [];
}

export async function saveBlockedSites(sites: BlockedSite[]): Promise<void> {
  await storage.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
}

export async function addBlockedSite(
  site: Omit<BlockedSite, "id" | "createdAt">
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

export async function updateBlockedSite(
  id: string,
  updates: Partial<BlockedSite>
): Promise<void> {
  const sites = await getBlockedSites();
  const index = sites.findIndex((s) => s.id === id);
  if (index !== -1) {
    sites[index] = { ...sites[index], ...updates };
    await saveBlockedSites(sites);
  }
}

export async function getStats(): Promise<SiteStats[]> {
  const result = (await browser.storage.local.get(
    STORAGE_KEYS.STATS
  )) as Record<string, SiteStats[] | undefined>;
  return result[STORAGE_KEYS.STATS] ?? [];
}

export async function getSettings(): Promise<Settings> {
  const result = (await storage.get(
    STORAGE_KEYS.SETTINGS
  )) as Record<string, Settings | undefined>;
  return { ...defaultSettings, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storage.set({ [STORAGE_KEYS.SETTINGS]: settings });
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
        hostMatches =
          normalizedHost === domain || normalizedHost.endsWith("." + domain);
      } else if (hostPattern.includes("*")) {
        const regexPattern = hostPattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`, "i");
        hostMatches =
          regex.test(normalizedHost) || regex.test(hostname.toLowerCase());
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
      return (
        cleanPath === cleanPattern || cleanPath.startsWith(cleanPattern + "/")
      );
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

  if (!schedule.days.includes(day)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = schedule.start.split(":").map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = schedule.end.split(":").map(Number);
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
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

export async function findMatchingBlockedSite(
  url: string
): Promise<BlockedSite | null> {
  const sites = await getBlockedSites();
  return sites.find((site) => urlMatchesSiteRules(url, site)) || null;
}
