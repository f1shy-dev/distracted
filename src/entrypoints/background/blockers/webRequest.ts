import { getBlockedSites, urlMatchesSiteRules, type BlockedSite } from "@/lib/storage";
import { ALARM_PREFIX } from "@/lib/consts";
import { isInternalUrl } from "../utils";

interface UnlockState {
  siteId: string;
  expiresAt: number;
}

let cachedSites: BlockedSite[] = [];
const unlockedSites = new Map<string, UnlockState>();

export async function refreshCache(): Promise<void> {
  cachedSites = await getBlockedSites();
}

export async function initializeWebRequest(): Promise<void> {
  await refreshCache();

  if (!browser.webRequest?.onBeforeRequest) {
    return;
  }

  browser.webRequest.onBeforeRequest.addListener(
    (details: { url: string; type: string; tabId: number }) => {
      if (details.type !== "main_frame") {
        return undefined;
      }

      const url = details.url;
      const tabId = details.tabId;

      if (isInternalUrl(url)) {
        return undefined;
      }

      for (const site of cachedSites) {
        if (!site.enabled) {
          continue;
        }

        const unlockState = unlockedSites.get(site.id);
        if (unlockState && unlockState.expiresAt > Date.now()) {
          continue;
        }

        const matches = urlMatchesSiteRules(url, site);

        if (matches) {
          const blockedPageUrl = browser.runtime.getURL(
            `/blocked.html?url=${encodeURIComponent(url)}&siteId=${encodeURIComponent(site.id)}`,
          );

          if (tabId && tabId !== -1) {
            browser.tabs.update(tabId, { url: blockedPageUrl }).catch((err) => {
              console.error(`[distracted] Failed to redirect tab ${tabId}:`, err);
            });
          }

          return { cancel: true };
        }
      }

      return undefined;
    },
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["blocking"],
  );
}

export async function grantAccess(
  siteId: string,
  durationMinutes: number | null,
): Promise<{ expiresAt: number }> {
  const durationMs = (durationMinutes ?? 60) * 60 * 1000;
  const expiresAt = Date.now() + durationMs;

  unlockedSites.set(siteId, { siteId, expiresAt });

  await browser.alarms.create(`${ALARM_PREFIX}${siteId}`, {
    when: expiresAt,
  });

  return { expiresAt };
}

export async function revokeAccess(siteId: string): Promise<number[]> {
  unlockedSites.delete(siteId);
  await browser.alarms.clear(`${ALARM_PREFIX}${siteId}`);

  const tabsToRedirect = await findTabsOnBlockedSite(siteId);

  return tabsToRedirect;
}

export async function findTabsOnBlockedSite(siteId: string): Promise<number[]> {
  const site = cachedSites.find((s) => s.id === siteId);
  if (!site) return [];

  const tabs = await browser.tabs.query({});
  const matchingTabIds: number[] = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (isInternalUrl(tab.url)) continue;

    if (urlMatchesSiteRules(tab.url, site)) {
      matchingTabIds.push(tab.id);
    }
  }

  return matchingTabIds;
}

export async function isSiteUnlocked(siteId: string): Promise<boolean> {
  const state = unlockedSites.get(siteId);
  if (!state) return false;

  if (state.expiresAt <= Date.now()) {
    unlockedSites.delete(siteId);
    return false;
  }

  return true;
}

export async function getUnlockState(siteId: string): Promise<UnlockState | null> {
  const state = unlockedSites.get(siteId);
  if (!state) return null;

  if (state.expiresAt <= Date.now()) {
    unlockedSites.delete(siteId);
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
  const tabsToRedirect = await revokeAccess(siteId);
  return { siteId, tabsToRedirect };
}

export async function syncRules(): Promise<void> {
  await refreshCache();
}
