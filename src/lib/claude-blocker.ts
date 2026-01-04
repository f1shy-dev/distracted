export type ClaudeBlockerCheckResult = {
  active: boolean;
  working: number;
  waitingForInput: number;
  blocked: boolean;
  reason?: "invalid_url" | "server_error" | "offline" | "idle";
  statusCode?: number;
};

export type ClaudeBlockerStateMessage = {
  type: "state";
  blocked?: boolean;
  sessions?: number;
  working?: number;
  waitingForInput?: number;
};

export function resolveClaudeBlockerStatusUrl(serverUrl: string): string | null {
  const trimmed = serverUrl.trim();
  if (!trimmed) return null;
  try {
    const base = trimmed.match(/^https?:\/\//) ? trimmed : `http://${trimmed}`;
    return new URL("/status", base).toString();
  } catch {
    return null;
  }
}

export function resolveClaudeBlockerWebSocketUrl(serverUrl: string): string | null {
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

export function parseClaudeBlockerStateMessage(payload: unknown): ClaudeBlockerCheckResult | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as ClaudeBlockerStateMessage;
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

export async function getClaudeBlockerStatus(serverUrl: string): Promise<ClaudeBlockerCheckResult> {
  const statusUrl = resolveClaudeBlockerStatusUrl(serverUrl);
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
    const response = await fetch(statusUrl, { cache: "no-store" });
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
