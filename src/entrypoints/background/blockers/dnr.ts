import { getBlockedSites, urlMatchesSiteRules } from "@/lib/storage";
import { RULE_ID_BASE, UNLOCK_PREFIX, ALARM_PREFIX } from "@/lib/consts";
import { isInternalUrl } from "../utils";

interface UnlockState {
  siteId: string;
  expiresAt: number;
}

export async function syncDnrRules(): Promise<void> {
  const sites = await getBlockedSites();
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map((r) => r.id);

  const session = await browser.storage.session.get();
  const unlockedIds = new Set<string>();
  const now = Date.now();

  for (const [key, value] of Object.entries(session)) {
    if (key.startsWith(UNLOCK_PREFIX)) {
      const state = value as any;
      if (state.expiresAt > now) {
        unlockedIds.add(state.siteId);
      }
    }
  }

  const newRules: Browser.declarativeNetRequest.Rule[] = [];
  let ruleIndex = 0;

  const patternToRegex = (pattern: string): string => {
    const normalized = pattern
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "");

    const hasPath = normalized.includes("/");
    let hostPattern: string;
    let pathPattern: string = "";

    if (hasPath) {
      const slashIndex = normalized.indexOf("/");
      hostPattern = normalized.slice(0, slashIndex);
      pathPattern = normalized.slice(slashIndex);
    } else {
      hostPattern = normalized;
    }

    let hostRegex: string;
    if (hostPattern.startsWith("*.")) {
      const domain = hostPattern.slice(2);
      const escapedDomain = domain.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      hostRegex = `([a-z0-9-]+\\.)*${escapedDomain}`;
    } else if (hostPattern.includes("*")) {
      const escapedHost = hostPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      hostRegex = `(www\\.)?${escapedHost}`;
    } else {
      const escapedHost = hostPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      hostRegex = `(www\\.)?${escapedHost}`;
    }

    let pathRegex: string;
    if (pathPattern) {
      const escapedPath = pathPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      if (pathPattern.endsWith("*")) {
        pathRegex = escapedPath;
      } else {
        pathRegex = `${escapedPath}(/.*|\\?.*)?`;
      }
    } else {
      pathRegex = "(/.*)?";
    }

    return `^https?://${hostRegex}${pathRegex}$`;
  };

  sites.forEach((site) => {
    if (!site.enabled) return;
    if (unlockedIds.has(site.id)) return;

    const blockRules = site.rules.filter((r) => !r.allow);
    blockRules.forEach((rule) => {
      newRules.push({
        id: RULE_ID_BASE + ruleIndex++,
        priority: 1,
        action: {
          type: "block",
        },
        condition: {
          regexFilter: patternToRegex(rule.pattern),
          resourceTypes: ["main_frame"],
        },
      });
    });

    const allowRules = site.rules.filter((r) => r.allow);
    allowRules.forEach((rule) => {
      newRules.push({
        id: RULE_ID_BASE + ruleIndex++,
        priority: 2,
        action: {
          type: "allow",
        },
        condition: {
          regexFilter: patternToRegex(rule.pattern),
          resourceTypes: ["main_frame"],
        },
      });
    });
  });

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: newRules,
  });

  console.log(
    `[distracted] DNR rules synced: ${newRules.length} rules for ${sites.filter((s) => s.enabled).length} sites`,
  );
}

export async function grantAccess(
  siteId: string,
  durationMinutes: number | null,
): Promise<{ expiresAt: number }> {
  const durationMs = (durationMinutes ?? 60) * 60 * 1000;
  const expiresAt = Date.now() + durationMs;

  const state: UnlockState = { siteId, expiresAt };
  await browser.storage.session.set({
    [`${UNLOCK_PREFIX}${siteId}`]: state,
  });

  await syncDnrRules();

  const alarmName = `${ALARM_PREFIX}${siteId}`;
  await browser.alarms.create(alarmName, {
    when: expiresAt,
  });

  console.log(`[distracted] Granted access to site ${siteId} for ${durationMinutes ?? 60} minutes`);

  return { expiresAt };
}

export async function revokeAccess(siteId: string): Promise<number[]> {
  await browser.storage.session.remove(`${UNLOCK_PREFIX}${siteId}`);
  await browser.alarms.clear(`${ALARM_PREFIX}${siteId}`);
  await syncDnrRules();
  const tabsToRedirect = await findTabsOnBlockedSite(siteId);

  console.log(
    `[distracted] Revoked access to site ${siteId}, ${tabsToRedirect.length} tabs to redirect`,
  );

  return tabsToRedirect;
}

/**
 * Find all tabs that are currently on a blocked site
 */
export async function findTabsOnBlockedSite(siteId: string): Promise<number[]> {
  const sites = await getBlockedSites();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return [];

  const tabs = await browser.tabs.query({});
  const matchingTabIds: number[] = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // Skip extension pages and internal URLs
    if (isInternalUrl(tab.url)) continue;

    if (urlMatchesSiteRules(tab.url, site)) {
      matchingTabIds.push(tab.id);
    }
  }

  return matchingTabIds;
}

/**
 * Check if a site is currently unlocked
 */
export async function isSiteUnlocked(siteId: string): Promise<boolean> {
  const result = await browser.storage.session.get(`${UNLOCK_PREFIX}${siteId}`);
  const state = result[`${UNLOCK_PREFIX}${siteId}`] as UnlockState | undefined;

  if (!state) return false;
  if (state.expiresAt <= Date.now()) {
    await browser.storage.session.remove(`${UNLOCK_PREFIX}${siteId}`);
    return false;
  }

  return true;
}

export async function getUnlockState(siteId: string): Promise<UnlockState | null> {
  const result = await browser.storage.session.get(`${UNLOCK_PREFIX}${siteId}`);
  const state = result[`${UNLOCK_PREFIX}${siteId}`] as UnlockState | undefined;

  if (!state) return null;
  if (state.expiresAt <= Date.now()) {
    await browser.storage.session.remove(`${UNLOCK_PREFIX}${siteId}`);
    return null;
  }

  return state;
}

export async function handleRelockAlarm(alarmName: string): Promise<{
  siteId: string;
  tabsToRedirect: number[];
} | null> {
  if (!alarmName.startsWith(ALARM_PREFIX)) return null;

  const siteId = alarmName.slice(ALARM_PREFIX.length);
  console.log(`[distracted] Relock alarm fired for site ${siteId}`);

  const tabsToRedirect = await revokeAccess(siteId);
  return { siteId, tabsToRedirect };
}

export async function initializeDnr(): Promise<void> {
  const session = await browser.storage.session.get();
  const now = Date.now();

  for (const [key, value] of Object.entries(session)) {
    if (key.startsWith(UNLOCK_PREFIX)) {
      const state = value as UnlockState;
      if (state.expiresAt <= now) {
        await browser.storage.session.remove(key);
        await browser.alarms.clear(`${ALARM_PREFIX}${state.siteId}`);
      }
    }
  }

  await syncDnrRules();
}
