import {
  findMatchingBlockedSite,
  getBlockedSites,
  getSettings,
} from "@/lib/storage";
import * as dnr from "./blockers/dnr";
import * as webRequest from "./blockers/webRequest";
import { isInternalUrl } from "./utils";

const isMV3 = import.meta.env.MANIFEST_VERSION === 3;
console.log(`[distracted] background entry`, {
  isMV3,
});

async function syncRules(): Promise<void> {
  if (isMV3) await dnr.syncDnrRules();
  else await webRequest.syncRules();
}

async function isSiteUnlocked(siteId: string): Promise<boolean> {
  if (isMV3) return dnr.isSiteUnlocked(siteId);
  else return webRequest.isSiteUnlocked(siteId);
}

async function getUnlockState(
  siteId: string
): Promise<{ siteId: string; expiresAt: number } | null> {
  if (isMV3) return dnr.getUnlockState(siteId);
  else return webRequest.getUnlockState(siteId);
}

export default defineBackground(() => {
  console.log("[distracted] Background script initialized");

  (async () => {
    if (isMV3) await dnr.initializeDnr();
    else await webRequest.initializeWebRequest();
  })().catch((err) => {
    console.error("[distracted] Failed to initialize blocker:", err);
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.blockedSites) {
      console.log("[distracted] Blocked sites changed, syncing rules");
      syncRules().catch((err) => {
        console.error("[distracted] Failed to sync rules:", err);
      });
    }
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    const result = isMV3
      ? await dnr.handleRelockAlarm(alarm.name)
      : await webRequest.handleRelockAlarm(alarm.name);
    if (!result) return;

    const { siteId, tabsToRedirect } = result;

    for (const tabId of tabsToRedirect) {
      try {
        const tab = await browser.tabs.get(tabId);
        if (!tab.url) continue;

        const blockedPageUrl = browser.runtime.getURL(
          `/blocked.html?url=${encodeURIComponent(tab.url)}&siteId=${encodeURIComponent(siteId)}`
        );
        await browser.tabs.update(tabId, { url: blockedPageUrl });
        console.log(`[distracted] Redirected tab ${tabId} after relock`);
      } catch (err) {
        console.log(`[distracted] Could not redirect tab ${tabId}:`, err);
      }
    }
  });

  async function checkAndBlockUrl(tabId: number, url: string, source: string) {
    if (isInternalUrl(url)) return;

    const site = await findMatchingBlockedSite(url);
    if (!site) return;

    const unlocked = await isSiteUnlocked(site.id);
    if (unlocked) return;

    console.log(`[distracted] Blocking (${source}): ${url}`);

    const blockedPageUrl = browser.runtime.getURL(
      `/blocked.html?url=${encodeURIComponent(url)}&siteId=${encodeURIComponent(site.id)}`
    );

    try {
      await browser.tabs.update(tabId, { url: blockedPageUrl });
    } catch (err) {
      console.error("[distracted] Failed to redirect to blocked page:", err);
    }
  }

  browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    if (!isMV3) return;
    await checkAndBlockUrl(details.tabId, details.url, "onBeforeNavigate");
  });

  browser.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await checkAndBlockUrl(details.tabId, details.url, "onHistoryStateUpdated");
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
    if (!changeInfo.url) return;
    await checkAndBlockUrl(tabId, changeInfo.url, "tabs.onUpdated");
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          case "CHECK_BLOCKED": {
            const url = message.url;
            const site = await findMatchingBlockedSite(url);
            if (site) {
              const settings = await getSettings();
              const unlocked = await isSiteUnlocked(site.id);
              sendResponse({
                blocked: !unlocked,
                site: unlocked ? null : site,
                statsEnabled: settings.statsEnabled,
              });
            } else {
              sendResponse({ blocked: false, site: null, statsEnabled: false });
            }
            break;
          }

          case "GET_SITE_INFO": {
            const { siteId, url } = message;
            const settings = await getSettings();

            let site = null;

            if (siteId) {
              const sites = await getBlockedSites();
              site = sites.find((s) => s.id === siteId) || null;
            }

            if (!site && url) {
              site = await findMatchingBlockedSite(url);
            }

            if (site) {
              const unlockState = await getUnlockState(site.id);
              if (unlockState) {
                sendResponse({
                  site,
                  statsEnabled: settings.statsEnabled,
                  alreadyUnlocked: true,
                  expiresAt: unlockState.expiresAt,
                });
              } else {
                sendResponse({
                  site,
                  statsEnabled: settings.statsEnabled,
                  alreadyUnlocked: false,
                });
              }
            } else {
              sendResponse({ site: null, statsEnabled: false });
            }
            break;
          }

          case "CHECK_UNLOCK_STATE": {
            const { siteId } = message;
            const unlockState = await getUnlockState(siteId);
            sendResponse({
              unlocked: !!unlockState,
              expiresAt: unlockState?.expiresAt ?? null,
            });
            break;
          }

          case "UNLOCK_SITE": {
            const { siteId, durationMinutes } = message;

            const { expiresAt } = isMV3
              ? await dnr.grantAccess(siteId, durationMinutes)
              : await webRequest.grantAccess(siteId, durationMinutes);

            sendResponse({ success: true, expiresAt });
            break;
          }

          case "UPDATE_STATS": {
            const { siteId, update } = message;
            (async () => {
              const statsResult = await browser.storage.local.get("stats");
              const stats = (statsResult["stats"] ?? []) as any[];
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

              await browser.storage.local.set({ stats });
            })().catch((err) => console.error("Failed to update stats:", err));

            sendResponse({ success: true });
            break;
          }

          case "GET_SETTINGS": {
            const settings = await getSettings();
            sendResponse({ settings });
            break;
          }

          case "GET_CURRENT_TAB_URL": {
            let url: string | null = null;
            try {
              const [tab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
              });
              url = tab?.url || null;
            } catch {
              url = null;
            }

            let domain = "";
            if (url) {
              try {
                const urlObj = new URL(url);
                domain = urlObj.hostname.replace(/^www\./, "");
              } catch {
                domain = "";
              }
            }

            sendResponse({ url, domain });
            break;
          }

          case "SYNC_RULES": {
            await syncRules();
            sendResponse({ success: true });
            break;
          }

          default:
            sendResponse({ error: "Unknown message type" });
        }
      } catch (error) {
        console.error("[distracted] Message handler error:", error);
        sendResponse({ error: String(error) });
      }
    })();

    return true;
  });
});
