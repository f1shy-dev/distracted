import {
  findMatchingBlockedSite,
  getBlockedSites,
  getSettings,
  normalizeStats,
  type BlockedSite,
  type SiteStats,
  type StatsScope,
  type UnlockMethod,
} from "@/lib/storage";
import { GUARD_ALARM_PREFIX, GUARD_PREFIX, STORAGE_KEYS, TIME_TRACK_ALARM } from "@/lib/consts";
import {
  getUnlockGuard,
  isContinuousUnlockMethod,
  type UnlockGuardState,
} from "@/lib/unlock-guards";
import * as dnr from "./blockers/dnr";
import * as webRequest from "./blockers/webRequest";
import { isInternalUrl } from "./utils";
import { startGuardWatcher, type GuardWatcherHandle } from "@/lib/guard-watcher";

const isMV3 = import.meta.env.MANIFEST_VERSION === 3;
console.log(`[distracted] background entry`, {
  isMV3,
});

let statsEnabled = true;

const GUARD_HEARTBEAT_MS = 3000;
const GUARD_WATCHDOG_MS = 12000;
const guardWatchers = new Map<string, GuardWatcherHandle>();

type GuardEntry = {
  siteId: string;
  method: UnlockMethod;
  settings: unknown;
};

const offscreenApi = (globalThis as { chrome?: { offscreen?: any } }).chrome?.offscreen;

async function ensureOffscreenDocument(): Promise<void> {
  if (!isMV3 || !offscreenApi) return;
  const hasDocument = (await offscreenApi.hasDocument?.()) as boolean | undefined;
  if (hasDocument) return;

  await offscreenApi.createDocument?.({
    url: browser.runtime.getURL(
      "/offscreen.html" as unknown as Parameters<typeof browser.runtime.getURL>[0],
    ),
    reasons: ["WORKERS"],
    justification: "Maintain unlock guards that require real-time server state via WebSocket.",
  });
}

async function maybeCloseOffscreenDocument(): Promise<void> {
  if (!isMV3 || !offscreenApi) return;
  const session = await browser.storage.session.get();
  const hasGuards = Object.keys(session).some((key) => key.startsWith(GUARD_PREFIX));
  if (!hasGuards) {
    const hasDocument = (await offscreenApi.hasDocument?.()) as boolean | undefined;
    if (hasDocument) {
      await offscreenApi.closeDocument?.();
    }
  }
}

async function scheduleGuardWatchdog(siteId: string): Promise<void> {
  await browser.alarms.create(`${GUARD_ALARM_PREFIX}${siteId}`, {
    when: Date.now() + GUARD_WATCHDOG_MS,
  });
}

async function clearGuardWatchdog(siteId: string): Promise<void> {
  await browser.alarms.clear(`${GUARD_ALARM_PREFIX}${siteId}`);
}

async function saveGuardEntry(entry: GuardEntry): Promise<void> {
  await browser.storage.session.set({
    [`${GUARD_PREFIX}${entry.siteId}`]: entry,
  });
}

async function removeGuardEntry(siteId: string): Promise<void> {
  await browser.storage.session.remove(`${GUARD_PREFIX}${siteId}`);
  await clearGuardWatchdog(siteId);
}

async function startGuardWatcherForEntry(entry: GuardEntry): Promise<void> {
  if (guardWatchers.has(entry.siteId)) return;

  const watcher = startGuardWatcher({
    method: entry.method,
    settings: entry.settings,
    heartbeatMs: GUARD_HEARTBEAT_MS,
    onState: (state) => {
      void handleGuardStateUpdate(entry.siteId, state, true);
    },
  });

  if (watcher) {
    guardWatchers.set(entry.siteId, watcher);
  }
}

async function stopGuardWatcher(siteId: string): Promise<void> {
  const watcher = guardWatchers.get(siteId);
  if (watcher) {
    watcher.stop();
    guardWatchers.delete(siteId);
  }
}

async function startGuardForSite(site: BlockedSite): Promise<void> {
  const guard = getUnlockGuard(site.unlockMethod);
  if (!guard) return;

  const entry: GuardEntry = {
    siteId: site.id,
    method: site.unlockMethod,
    settings: site.challengeSettings,
  };

  await saveGuardEntry(entry);
  await scheduleGuardWatchdog(site.id);

  if (isMV3 && offscreenApi) {
    await ensureOffscreenDocument();
    try {
      await browser.runtime.sendMessage({
        type: "GUARD_START",
        siteId: entry.siteId,
        method: entry.method,
        settings: entry.settings,
        heartbeatMs: GUARD_HEARTBEAT_MS,
        pollIntervalMs: guard.pollIntervalMs,
      });
    } catch (error) {
      console.warn("[distracted] Failed to start guard in offscreen:", error);
    }
  } else {
    await startGuardWatcherForEntry(entry);
  }
}

async function stopGuardForSite(siteId: string): Promise<void> {
  await removeGuardEntry(siteId);

  if (isMV3 && offscreenApi) {
    try {
      await browser.runtime.sendMessage({
        type: "GUARD_STOP",
        siteId,
      });
    } catch (error) {
      console.warn("[distracted] Failed to stop guard in offscreen:", error);
    }
    await maybeCloseOffscreenDocument();
  } else {
    await stopGuardWatcher(siteId);
  }
}

async function restoreGuardSessions(): Promise<void> {
  const session = await browser.storage.session.get();
  const entries = Object.entries(session)
    .filter(([key]) => key.startsWith(GUARD_PREFIX))
    .map(([, value]) => value as GuardEntry);

  if (entries.length === 0) return;

  const activeEntries: GuardEntry[] = [];
  for (const entry of entries) {
    const unlocked = await isSiteUnlocked(entry.siteId);
    if (unlocked) {
      activeEntries.push(entry);
    } else {
      await removeGuardEntry(entry.siteId);
    }
  }

  if (activeEntries.length === 0) return;

  if (isMV3 && offscreenApi) {
    await ensureOffscreenDocument();
    for (const entry of activeEntries) {
      await scheduleGuardWatchdog(entry.siteId);
      try {
        await browser.runtime.sendMessage({
          type: "GUARD_START",
          siteId: entry.siteId,
          method: entry.method,
          settings: entry.settings,
          heartbeatMs: GUARD_HEARTBEAT_MS,
        });
      } catch (error) {
        console.warn("[distracted] Failed to restore guard in offscreen:", error);
      }
    }
  } else {
    for (const entry of activeEntries) {
      await scheduleGuardWatchdog(entry.siteId);
      await startGuardWatcherForEntry(entry);
    }
  }
}

async function handleGuardStateUpdate(
  siteId: string,
  state: UnlockGuardState,
  fromBackgroundWatcher = false,
): Promise<void> {
  if (state.active) {
    await scheduleGuardWatchdog(siteId);
    return;
  }

  if (fromBackgroundWatcher) {
    await stopGuardWatcher(siteId);
  }

  const unlocked = await isSiteUnlocked(siteId);
  if (!unlocked) {
    await stopGuardForSite(siteId);
    return;
  }

  const tabsToRedirect = isMV3
    ? await dnr.revokeAccess(siteId)
    : await webRequest.revokeAccess(siteId);

  await stopGuardForSite(siteId);

  for (const tabId of tabsToRedirect) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab.url) continue;

      const blockedPageUrl = browser.runtime.getURL(
        `/blocked.html?url=${encodeURIComponent(tab.url)}&siteId=${encodeURIComponent(siteId)}`,
      );
      await browser.tabs.update(tabId, { url: blockedPageUrl });
      console.log(`[distracted] Redirected tab ${tabId} after guard relock`);
    } catch (err) {
      console.log(`[distracted] Could not redirect tab ${tabId}:`, err);
    }
  }
}

async function syncRules(): Promise<void> {
  if (isMV3) await dnr.syncDnrRules();
  else await webRequest.syncRules();
}

async function isSiteUnlocked(siteId: string): Promise<boolean> {
  if (isMV3) return dnr.isSiteUnlocked(siteId);
  else return webRequest.isSiteUnlocked(siteId);
}

async function getUnlockState(
  siteId: string,
): Promise<{ siteId: string; expiresAt: number | null } | null> {
  if (isMV3) return dnr.getUnlockState(siteId);
  else return webRequest.getUnlockState(siteId);
}

function normalizeDomain(domain: string | undefined): string | null {
  if (!domain) return null;
  return domain.toLowerCase().replace(/^www\./, "");
}

function getDomainFromUrl(url: string): string | null {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

function getOrCreateStat(
  stats: SiteStats[],
  scope: StatsScope,
  key: string,
  meta: { siteId?: string; domain?: string },
): SiteStats {
  let entry = stats.find((stat) => stat.scope === scope && stat.key === key);
  if (!entry) {
    entry = {
      scope,
      key,
      siteId: meta.siteId,
      domain: meta.domain,
      visitCount: 0,
      passedCount: 0,
      timeSpentMs: 0,
      lastVisit: 0,
    };
    stats.push(entry);
  }
  return entry;
}

async function refreshStatsEnabled(): Promise<void> {
  try {
    const settings = await getSettings();
    statsEnabled = settings.statsEnabled;
  } catch (error) {
    console.error("[distracted] Failed to load settings:", error);
  }
}

async function applyStatsUpdate({
  siteId,
  domain,
  update,
}: {
  siteId?: string | null;
  domain?: string | null;
  update: {
    incrementVisit?: boolean;
    incrementPassed?: boolean;
    addTime?: number;
  };
}): Promise<void> {
  if (!statsEnabled) return;

  const statsResult = await browser.storage.local.get(STORAGE_KEYS.STATS);
  const rawStats = (statsResult[STORAGE_KEYS.STATS] ?? []) as SiteStats[];
  const normalized = normalizeStats(rawStats);
  const stats = normalized.stats;

  const normalizedDomain = normalizeDomain(domain ?? undefined);
  const entries: SiteStats[] = [];

  if (siteId && typeof siteId === "string") {
    entries.push(getOrCreateStat(stats, "site", siteId, { siteId }));
  }

  if (normalizedDomain) {
    entries.push(
      getOrCreateStat(stats, "domain", normalizedDomain, {
        domain: normalizedDomain,
      }),
    );
  }

  if (entries.length === 0) return;

  const now = Date.now();
  for (const entry of entries) {
    if (update.incrementVisit) entry.visitCount += 1;
    if (update.incrementPassed) entry.passedCount += 1;
    if (update.addTime) entry.timeSpentMs += update.addTime;
    entry.lastVisit = now;
  }

  await browser.storage.local.set({
    [STORAGE_KEYS.STATS]: stats,
  });
}

type ActiveSession = {
  tabId: number | null;
  url: string | null;
  domain: string | null;
  siteId: string | null;
  lastActiveAt: number | null;
};

function createMV3TimeTracker() {
  let active: ActiveSession = {
    tabId: null,
    url: null,
    domain: null,
    siteId: null,
    lastActiveAt: null,
  };
  let focused = true;
  let pending = Promise.resolve();

  const queue = (fn: () => Promise<void>) => {
    pending = pending
      .catch(() => {})
      .then(fn)
      .catch((error) => {
        console.error("[distracted] Time tracker error:", error);
      });
    return pending;
  };

  const resolveTabUrl = async (tabId: number, url?: string | null): Promise<string | null> => {
    if (url !== undefined) return url;
    try {
      const tab = await browser.tabs.get(tabId);
      return tab.url ?? null;
    } catch {
      return null;
    }
  };

  const isTrackableUrl = (url: string | null): url is string => !!url && !isInternalUrl(url);

  const finalizeActive = async (now: number) => {
    if (!active.lastActiveAt || !active.siteId || !focused || !statsEnabled) {
      return;
    }
    const elapsed = now - active.lastActiveAt;
    if (elapsed <= 0) return;
    await applyStatsUpdate({
      siteId: active.siteId,
      domain: active.domain,
      update: { addTime: elapsed },
    });
    active.lastActiveAt = now;
  };

  const setActiveFromTab = async (tabId: number, url?: string | null) => {
    const resolvedUrl = await resolveTabUrl(tabId, url);
    active.tabId = tabId;
    active.url = resolvedUrl ?? null;
    active.domain = resolvedUrl ? getDomainFromUrl(resolvedUrl) : null;

    if (!resolvedUrl || !isTrackableUrl(resolvedUrl)) {
      active.siteId = null;
      active.lastActiveAt = null;
      return;
    }

    const match = await findMatchingBlockedSite(resolvedUrl);
    active.siteId = match?.id ?? null;
    active.lastActiveAt = active.siteId && focused && statsEnabled ? Date.now() : null;
  };

  const switchToTab = async (tabId: number, url?: string | null) => {
    const now = Date.now();
    await finalizeActive(now);
    await setActiveFromTab(tabId, url);
  };

  const refreshActive = async () => {
    if (!active.tabId) return;
    const now = Date.now();
    const url = active.url;

    if (!url || !isTrackableUrl(url)) {
      await finalizeActive(now);
      active.siteId = null;
      active.lastActiveAt = null;
      active.domain = null;
      return;
    }

    const match = await findMatchingBlockedSite(url);
    active.domain = getDomainFromUrl(url);

    if (active.siteId && active.lastActiveAt) {
      await finalizeActive(now);
    }

    const shouldTrack = !!match?.id && focused && statsEnabled;
    active.siteId = match?.id ?? null;
    active.lastActiveAt = shouldTrack ? now : null;
  };

  const initialize = async () => {
    await refreshStatsEnabled();
    if (focused) {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await setActiveFromTab(tab.id, tab.url);
      }
    }
    await browser.alarms.create(TIME_TRACK_ALARM, { periodInMinutes: 1 });
  };

  const onTabActivated = (info: { tabId: number }) =>
    queue(async () => {
      if (!focused) return;
      await switchToTab(info.tabId);
    });

  const onTabUpdated = (tabId: number, changeInfo: { url?: string }, _tab: { url?: string }) =>
    queue(async () => {
      if (!active.tabId || tabId !== active.tabId) return;
      if (!changeInfo.url) return;
      await switchToTab(tabId, changeInfo.url);
    });

  const onHistoryStateUpdated = (details: { tabId: number; url?: string }) =>
    queue(async () => {
      if (!active.tabId || details.tabId !== active.tabId) return;
      if (!details.url) return;
      await switchToTab(details.tabId, details.url);
    });

  const onFocusChanged = (windowId: number) =>
    queue(async () => {
      const now = Date.now();
      if (windowId === browser.windows.WINDOW_ID_NONE) {
        await finalizeActive(now);
        focused = false;
        active.lastActiveAt = null;
        return;
      }
      focused = true;
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await switchToTab(tab.id, tab.url ?? null);
      }
    });

  const onTabRemoved = (tabId: number) =>
    queue(async () => {
      if (active.tabId !== tabId) return;
      const now = Date.now();
      await finalizeActive(now);
      active = {
        tabId: null,
        url: null,
        domain: null,
        siteId: null,
        lastActiveAt: null,
      };
    });

  const onAlarm = (alarm: { name: string }) =>
    queue(async () => {
      if (alarm.name !== TIME_TRACK_ALARM) return;
      await refreshActive();
    });

  const onSettingsChanged = () =>
    queue(async () => {
      await refreshStatsEnabled();
      await refreshActive();
    });

  const onRulesChanged = () =>
    queue(async () => {
      await refreshActive();
    });

  return {
    initialize,
    onTabActivated,
    onTabUpdated,
    onHistoryStateUpdated,
    onFocusChanged,
    onTabRemoved,
    onAlarm,
    onSettingsChanged,
    onRulesChanged,
  };
}

export default defineBackground(() => {
  console.log("[distracted] Background script initialized");

  const mv3Tracker = isMV3 ? createMV3TimeTracker() : null;

  (async () => {
    if (isMV3) await dnr.initializeDnr();
    else await webRequest.initializeWebRequest();
    await restoreGuardSessions();
  })().catch((err) => {
    console.error("[distracted] Failed to initialize blocker:", err);
  });

  (async () => {
    if (mv3Tracker) {
      await mv3Tracker.initialize();
    } else {
      await refreshStatsEnabled();
    }
  })().catch((err) => {
    console.error("[distracted] Failed to initialize tracker:", err);
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    const blockedSitesChanged = changes[STORAGE_KEYS.BLOCKED_SITES];
    if ((areaName === "local" || areaName === "sync") && blockedSitesChanged) {
      console.log("[distracted] Blocked sites changed, syncing rules");
      syncRules().catch((err) => {
        console.error("[distracted] Failed to sync rules:", err);
      });
      if (mv3Tracker) {
        void mv3Tracker.onRulesChanged();
      }
    }

    const settingsChanged = changes[STORAGE_KEYS.SETTINGS];
    if ((areaName === "local" || areaName === "sync") && settingsChanged) {
      if (mv3Tracker) {
        void mv3Tracker.onSettingsChanged();
      } else {
        refreshStatsEnabled().catch((err) => {
          console.error("[distracted] Failed to refresh settings:", err);
        });
      }
    }
  });

  if (mv3Tracker) {
    browser.tabs.onActivated.addListener(mv3Tracker.onTabActivated);
    browser.tabs.onUpdated.addListener(mv3Tracker.onTabUpdated);
    browser.tabs.onRemoved.addListener(mv3Tracker.onTabRemoved);
    browser.windows.onFocusChanged.addListener(mv3Tracker.onFocusChanged);
    browser.webNavigation.onHistoryStateUpdated.addListener(mv3Tracker.onHistoryStateUpdated);
    browser.alarms.onAlarm.addListener(mv3Tracker.onAlarm);
  }

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith(GUARD_ALARM_PREFIX)) {
      const siteId = alarm.name.slice(GUARD_ALARM_PREFIX.length);
      await handleGuardStateUpdate(siteId, { active: false, reason: "offline" });
      return;
    }

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
          `/blocked.html?url=${encodeURIComponent(tab.url)}&siteId=${encodeURIComponent(siteId)}`,
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
      `/blocked.html?url=${encodeURIComponent(url)}&siteId=${encodeURIComponent(site.id)}`,
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
    void (async () => {
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

            const sites = await getBlockedSites();
            const site = sites.find((entry) => entry.id === siteId);

            if (!site) {
              sendResponse({ success: false, error: "Blocked site not found" });
              break;
            }

            if (isContinuousUnlockMethod(site.unlockMethod)) {
              const guard = getUnlockGuard(site.unlockMethod);
              if (!guard) {
                sendResponse({ success: false, error: "Unlock guard not available" });
                break;
              }

              const guardState = await guard.check(site.challengeSettings);
              if (!guardState.active) {
                sendResponse({
                  success: false,
                  error: guardState.message ?? "Unlock condition not met",
                });
                break;
              }

              const { expiresAt } = isMV3
                ? await dnr.grantAccess(siteId, durationMinutes, "continuous")
                : await webRequest.grantAccess(siteId, durationMinutes, "continuous");

              await startGuardForSite(site);
              sendResponse({ success: true, expiresAt });
            } else {
              const { expiresAt } = isMV3
                ? await dnr.grantAccess(siteId, durationMinutes, "timed")
                : await webRequest.grantAccess(siteId, durationMinutes, "timed");

              sendResponse({ success: true, expiresAt });
            }
            break;
          }

          case "UPDATE_STATS": {
            const { siteId, update, domain } = message;
            (async () => {
              await applyStatsUpdate({
                siteId,
                domain,
                update,
              });
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

          case "GUARD_STATE_UPDATE": {
            const { siteId, state } = message;
            await handleGuardStateUpdate(siteId, state as UnlockGuardState);
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
