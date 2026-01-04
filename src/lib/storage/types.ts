import type { UnlockMethod, ChallengeSettingsMap } from "@/lib/challenges";

export interface PatternRule {
  pattern: string; // URL pattern (e.g., "twitter.com", "*.reddit.com", "x.com/messages")
  allow: boolean; // true = allow (whitelist), false = block
}

export interface Schedule {
  enabled: boolean;
  days: number[];
  start: string;
  end: string;
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
  strict?: boolean; // legacy: replaced by unlockMethod = "strict"
  schedule?: Schedule;
}

export type StatsScope = "site" | "domain";

export interface SiteStats {
  scope: StatsScope;
  key: string;
  siteId?: string;
  domain?: string;
  visitCount: number;
  passedCount: number;
  timeSpentMs: number; // time spent on site after unlocking
  lastVisit: number;
}

export interface Settings {
  statsEnabled: boolean;
}
