import { getUnlockGuard, type UnlockGuardState } from "@/lib/unlock-guards";
import type { UnlockMethod } from "@/lib/challenges/manifest";

type GuardWatcherOptions = {
  method: UnlockMethod;
  settings: unknown;
  onState: (state: UnlockGuardState) => void;
  heartbeatMs?: number;
  pollIntervalMs?: number;
};

export type GuardWatcherHandle = {
  stop: () => void;
};

export function startGuardWatcher({
  method,
  settings,
  onState,
  heartbeatMs = 5000,
  pollIntervalMs,
}: GuardWatcherOptions): GuardWatcherHandle | null {
  const guard = getUnlockGuard(method);
  if (!guard) return null;

  let stopped = false;
  let socket: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastState: UnlockGuardState | null = null;

  const emitState = (state: UnlockGuardState) => {
    if (stopped) return;
    lastState = state;
    onState(state);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (socket) {
      socket.close();
      socket = null;
    }
  };

  const handleGuardState = (state: UnlockGuardState) => {
    emitState(state);
    if (!state.active) {
      stop();
    }
  };

  const runCheck = async () => {
    try {
      const state = await guard.check(settings as never);
      handleGuardState(state);
    } catch {
      handleGuardState({ active: false, reason: "offline" });
    }
  };

  const startPolling = () => {
    const interval = pollIntervalMs ?? guard.pollIntervalMs ?? 5000;
    void runCheck();
    pollTimer = setInterval(() => {
      void runCheck();
    }, interval);
  };

  const startHeartbeat = () => {
    heartbeatTimer = setInterval(() => {
      if (lastState?.active) {
        emitState(lastState);
      }
    }, heartbeatMs);
  };

  const wsUrl = guard.getWebSocketUrl?.(settings as never);
  if (wsUrl) {
    socket = new WebSocket(wsUrl);
    void runCheck();
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        const state = guard.parseWebSocketMessage?.(payload, settings as never);
        if (state) {
          handleGuardState(state);
        }
      } catch {
        // Ignore malformed messages
      }
    });
    socket.addEventListener("close", () => {
      handleGuardState({ active: false, reason: "offline" });
    });
    socket.addEventListener("error", () => {
      handleGuardState({ active: false, reason: "offline" });
    });

    startHeartbeat();
  } else {
    startPolling();
  }

  return { stop };
}
