import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { randomUUID } from "node:crypto";

const DEFAULT_PORT = 8765;

interface HookPayload {
  session_id: string;
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "Stop" | "SessionStart" | "SessionEnd";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  source: "pi";
}

function getPort(): number {
  const envPort = process.env["DISTRACTED_PORT"];
  if (envPort) {
    const parsed = Number.parseInt(envPort, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
  }
  return DEFAULT_PORT;
}

async function sendHook(payload: HookPayload): Promise<void> {
  const port = getPort();
  const url = `http://localhost:${port}/hook`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Server might not be running - don't disrupt workflow
  }
}

export default function (pi: ExtensionAPI) {
  const sessionId = randomUUID();
  let cwd: string | undefined;

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    await sendHook({ session_id: sessionId, hook_event_name: "SessionStart", cwd, source: "pi" });
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    await sendHook({
      session_id: sessionId,
      hook_event_name: "UserPromptSubmit",
      cwd,
      source: "pi",
    });
  });

  pi.on("tool_call", async (event, ctx) => {
    cwd = ctx.cwd;
    await sendHook({
      session_id: sessionId,
      hook_event_name: "PreToolUse",
      tool_name: event.toolName,
      tool_input: event.input as Record<string, unknown>,
      cwd,
      source: "pi",
    });
  });

  pi.on("agent_end", async (_event, ctx) => {
    cwd = ctx.cwd;
    await sendHook({ session_id: sessionId, hook_event_name: "Stop", cwd, source: "pi" });
  });

  pi.on("session_shutdown", async () => {
    await sendHook({ session_id: sessionId, hook_event_name: "SessionEnd", cwd, source: "pi" });
  });
}
