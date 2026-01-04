export type AiAgentCheckResult = {
  active: boolean;
  working: number;
  waitingForInput: number;
  blocked: boolean;
  reason?: "invalid_url" | "server_error" | "offline" | "idle";
  statusCode?: number;
};

export type AiAgentStateMessage = {
  type: "state";
  blocked?: boolean;
  sessions?: number;
  working?: number;
  waitingForInput?: number;
};

function resolveAiAgentStatusUrl(serverUrl: string): string | null {
  const trimmed = serverUrl.trim();
  if (!trimmed) return null;
  try {
    const base = trimmed.match(/^https?:\/\//) ? trimmed : `http://${trimmed}`;
    return new URL("/status", base).toString();
  } catch {
    return null;
  }
}

export function resolveAiAgentWebSocketUrl(serverUrl: string): string | null {
  const trimmed = serverUrl.trim();
  if (!trimmed) return null;
  try {
    const base = trimmed.match(/^https?:\/\//) ? trimmed : `http://${trimmed}`;
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function parseAiAgentStateMessage(payload: unknown): AiAgentCheckResult | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as AiAgentStateMessage;
  if (data.type !== "state") return null;

  const working = typeof data.working === "number" ? data.working : 0;
  const waitingForInput = typeof data.waitingForInput === "number" ? data.waitingForInput : 0;
  const blocked = typeof data.blocked === "boolean" ? data.blocked : working === 0;
  const active = !blocked && working > 0;

  return {
    active,
    blocked,
    working,
    waitingForInput,
    reason: active ? undefined : "idle",
  };
}

export async function getAiAgentStatus(serverUrl: string): Promise<AiAgentCheckResult> {
  const statusUrl = resolveAiAgentStatusUrl(serverUrl);
  if (!statusUrl) {
    return {
      active: false,
      blocked: true,
      working: 0,
      waitingForInput: 0,
      reason: "invalid_url",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(statusUrl, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return {
        active: false,
        blocked: true,
        working: 0,
        waitingForInput: 0,
        reason: "server_error",
        statusCode: response.status,
      };
    }

    const data = (await response.json()) as {
      blocked?: boolean;
      sessions?: Array<{ status?: string }>;
    };

    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const working = sessions.filter((session) => session?.status === "working").length;
    const waitingForInput = sessions.filter(
      (session) => session?.status === "waiting_for_input",
    ).length;
    const blocked = typeof data.blocked === "boolean" ? data.blocked : working === 0;
    const active = !blocked && working > 0;

    return {
      active,
      blocked,
      working,
      waitingForInput,
      reason: active ? undefined : "idle",
    };
  } catch {
    return {
      active: false,
      blocked: true,
      working: 0,
      waitingForInput: 0,
      reason: "offline",
    };
  }
}
