export const DEFAULT_AUTO_RELOCK = 3;

export const STORAGE_KEYS = {
  BLOCKED_SITES: "blockedSites",
  STATS: "siteStats",
  SETTINGS: "settings",
} as const;

export const RULE_ID_BASE = 1000;
export const MAX_RULES_PER_SITE = 100; // Max patterns per site
export const UNLOCK_PREFIX = "unlock_";
export const ALARM_PREFIX = "relock_";
