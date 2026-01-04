import type { CapyJam, CapyStatusResult } from "../types/capy";
import { getCapyConfig } from "../setup/capy";

const CAPY_BASE_URL = "https://capy.ai";

export async function getCapyStatus(): Promise<CapyStatusResult> {
  const config = await getCapyConfig();

  if (!config?.apiToken) {
    return { active: false, working: 0, sessions: 0, reason: "invalid_token" };
  }

  const baseUrl = (config.baseUrl || CAPY_BASE_URL).replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/trpc/jam.list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
        "x-trpc-source": "distracted",
      },
      body: JSON.stringify({ json: { limit: 50, cursor: 0 } }),
    });

    if (!response.ok) {
      return { active: false, working: 0, sessions: 0, reason: "server_error" };
    }

    const data = (await response.json()) as {
      result?: { data?: { json?: { items?: unknown } } };
    };

    const items = data.result?.data?.json?.items;
    const jams: CapyJam[] = Array.isArray(items) ? (items as CapyJam[]) : [];

    const activeStatuses: CapyJam["status"][] = ["starting", "continuing", "acting"];
    const workingJams = jams.filter((jam) => activeStatuses.includes(jam.status));

    return {
      active: workingJams.length > 0,
      working: workingJams.length,
      sessions: jams.length,
      reason: workingJams.length > 0 ? undefined : "idle",
    };
  } catch {
    return { active: false, working: 0, sessions: 0, reason: "offline" };
  }
}
