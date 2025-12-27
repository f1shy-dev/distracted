// Types for the extension

export type UnlockMethod = "timer" | "hold" | "type";

export interface PatternRule {
  pattern: string; // URL pattern (e.g., "twitter.com", "*.reddit.com", "x.com/messages")
  allow: boolean; // true = allow (whitelist), false = block
}

export interface BlockedSite {
  id: string;
  name: string;
  rules: PatternRule[];
  unlockMethod: UnlockMethod;
  unlockDuration: number;
  autoRelockAfter: number | null;
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

// Default values
export const defaultSettings: Settings = {
  statsEnabled: true,
};

export const DEFAULT_AUTO_RELOCK = 3; // 3 minutes default

// Storage keys
const STORAGE_KEYS = {
  BLOCKED_SITES: "blockedSites",
  STATS: "siteStats",
  SETTINGS: "settings",
} as const;

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
    id: generateId(),
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

export async function deleteBlockedSite(id: string): Promise<void> {
  const sites = await getBlockedSites();
  await saveBlockedSites(sites.filter((s) => s.id !== id));
}

// Stats helpers
export async function getStats(): Promise<SiteStats[]> {
  const result = (await browser.storage.local.get(
    STORAGE_KEYS.STATS
  )) as Record<string, SiteStats[] | undefined>;
  return result[STORAGE_KEYS.STATS] ?? [];
}

export async function updateStats(
  siteId: string,
  update: Partial<SiteStats> & {
    incrementVisit?: boolean;
    incrementPassed?: boolean;
    addTime?: number;
  }
): Promise<void> {
  const stats = await getStats();
  let siteStats = stats.find((s) => s.siteId === siteId);

  if (!siteStats) {
    siteStats = {
      siteId,
      visitCount: 0,
      passedCount: 0,
      timeSpentMs: 0,
      lastVisit: Date.now(),
    };
    stats.push(siteStats);
  }

  if (update.incrementVisit) siteStats.visitCount++;
  if (update.incrementPassed) siteStats.passedCount++;
  if (update.addTime) siteStats.timeSpentMs += update.addTime;
  siteStats.lastVisit = Date.now();

  await browser.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}

export async function clearStats(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.STATS]: [] });
}

// Settings helpers
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
    const fullPath = hostname + pathname;

    // Normalize pattern: strip protocol if accidentally included
    let normalizedPattern = pattern.toLowerCase().trim();
    normalizedPattern = normalizedPattern
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "");

    // Handle path patterns (e.g., "x.com/messages")
    if (normalizedPattern.includes("/")) {
      const [patternHost, ...pathParts] = normalizedPattern.split("/");
      const patternPath = "/" + pathParts.join("/");

      // Check if hostname matches
      let hostMatches = false;
      if (patternHost.startsWith("*.")) {
        const domain = patternHost.slice(2);
        hostMatches = hostname === domain || hostname.endsWith("." + domain);
      } else {
        hostMatches =
          hostname === patternHost ||
          hostname === "www." + patternHost ||
          hostname.replace(/^www\./, "") === patternHost;
      }

      if (!hostMatches) return false;

      // Check if path matches (prefix match)
      return (
        pathname.startsWith(patternPath) ||
        pathname === patternPath.replace(/\/$/, "")
      );
    }

    // Handle wildcard patterns like "*.example.com"
    if (normalizedPattern.startsWith("*.")) {
      const domain = normalizedPattern.slice(2);
      return hostname === domain || hostname.endsWith("." + domain);
    }

    // Handle exact domain matches (also match www. variants)
    return (
      hostname === normalizedPattern ||
      hostname === "www." + normalizedPattern ||
      hostname.replace(/^www\./, "") === normalizedPattern
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

// Check if URL matches a blocked site's rules
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
        // Allow rule matches - don't block this URL
        return false;
      } else {
        // Block rule matches
        isBlocked = true;
      }
    }
  }

  return isBlocked;
}

// Find matching blocked site for a URL
export async function findMatchingBlockedSite(
  url: string
): Promise<BlockedSite | null> {
  const sites = await getBlockedSites();
  return sites.find((site) => urlMatchesSiteRules(url, site)) || null;
}

// Format time duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Get current tab URL (for popup)
export async function getCurrentTabUrl(): Promise<string | null> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.url || null;
  } catch {
    return null;
  }
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
