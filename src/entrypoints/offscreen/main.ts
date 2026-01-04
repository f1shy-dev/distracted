import { startGuardWatcher, type GuardWatcherHandle } from "@/lib/guard-watcher";
import type { UnlockMethod } from "@/lib/challenges/manifest";
import type { UnlockGuardState } from "@/lib/unlock-guards";

type GuardStartMessage = {
  type: "GUARD_START";
  siteId: string;
  method: UnlockMethod;
  settings: unknown;
  heartbeatMs?: number;
  pollIntervalMs?: number;
};

type GuardStopMessage = {
  type: "GUARD_STOP";
  siteId: string;
};

type GuardMessage = GuardStartMessage | GuardStopMessage;

const watchers = new Map<string, GuardWatcherHandle>();

function sendGuardState(siteId: string, state: UnlockGuardState) {
  void browser.runtime.sendMessage({
    type: "GUARD_STATE_UPDATE",
    siteId,
    state,
  });
}

function startGuard(message: GuardStartMessage) {
  const existing = watchers.get(message.siteId);
  if (existing) {
    existing.stop();
    watchers.delete(message.siteId);
  }

  const watcher = startGuardWatcher({
    method: message.method,
    settings: message.settings,
    heartbeatMs: message.heartbeatMs,
    pollIntervalMs: message.pollIntervalMs,
    onState: (state) => {
      sendGuardState(message.siteId, state);
      if (!state.active) {
        const handle = watchers.get(message.siteId);
        handle?.stop();
        watchers.delete(message.siteId);
      }
    },
  });

  if (watcher) {
    watchers.set(message.siteId, watcher);
  } else {
    sendGuardState(message.siteId, { active: false, reason: "offline" });
  }
}

function stopGuard(message: GuardStopMessage) {
  const watcher = watchers.get(message.siteId);
  if (watcher) {
    watcher.stop();
    watchers.delete(message.siteId);
  }
}

browser.runtime.onMessage.addListener((message: GuardMessage) => {
  if (message.type === "GUARD_START") {
    startGuard(message);
  } else if (message.type === "GUARD_STOP") {
    stopGuard(message);
  }
});
