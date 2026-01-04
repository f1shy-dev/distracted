import type { CapyJam, CapyStatusResult } from "../types/capy";
import { getCapyConfig } from "../setup/capy";

const CAPY_BASE_URL = "https://dev.capy.ai";

export async function getCapyStatus(): Promise<CapyStatusResult> {
  const config = await getCapyConfig();

  if (!config?.apiToken) {
    return { active: false, working: 0, sessions: 0, reason: "invalid_token" };
  }

  const baseUrl = (config.baseUrl || CAPY_BASE_URL).replace(/\/$/, "");

  try {
    const input = JSON.stringify({
      json: { limit: 50, cursor: 0, activeOnly: true, includeAllOrgJams: true },
    });
    const response = await fetch(
      `${baseUrl}/api/trpc/jam.list?input=${encodeURIComponent(input)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "x-trpc-source": "distracted",
        },
      },
    );

    if (!response.ok) {
      console.error(response.statusText);
      console.error(await response.text());
      return { active: false, working: 0, sessions: 0, reason: "server_error" };
    }

    const data = (await response.json()) as {
      result?: { data?: { json?: { jams?: unknown } } };
    };

    const items = data.result?.data?.json?.jams;
    const jams: CapyJam[] = Array.isArray(items) ? (items as CapyJam[]) : [];

    const activeStatuses: CapyJam["status"][] = ["starting", "continuing", "acting"];
    const workingJams = jams.filter((jam) => activeStatuses.includes(jam.status));

    return {
      active: workingJams.length > 0,
      working: workingJams.length,
      sessions: jams.length,
      reason: workingJams.length > 0 ? undefined : "idle",
      ...(workingJams.length > 0
        ? {
            sample: {
              id: workingJams[0].id.slice(0, 8),
              title: workingJams[0].title,
              status: workingJams[0].status,
            },
          }
        : {}),
    };
  } catch (error) {
    console.error(error);
    return { active: false, working: 0, sessions: 0, reason: "offline" };
  }
}
