import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const DISTRACTED_PORT = process.env.DISTRACTED_PORT
  ? parseInt(process.env.DISTRACTED_PORT, 10)
  : 8765;
const DISTRACTED_URL = `http://localhost:${DISTRACTED_PORT}/hook`;

type HookPayload = {
  session_id: string;
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "Stop" | "SessionStart" | "SessionEnd";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  source: "pi";
};

async function sendHook(payload: HookPayload): Promise<void> {
  try {
    fetch(DISTRACTED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

let currentSessionId: string | null = null;

export default function distractedExtension(pi: ExtensionAPI): void {
  pi.setLabel("Distracted");

  pi.on("session_start", async (_event, ctx) => {
    currentSessionId = `pi-${Date.now()}`;
    await sendHook({
      session_id: currentSessionId,
      hook_event_name: "SessionStart",
      cwd: ctx.cwd,
      source: "pi",
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!currentSessionId) return;
    await sendHook({
      session_id: currentSessionId,
      hook_event_name: "SessionEnd",
      cwd: ctx.cwd,
      source: "pi",
    });
    currentSessionId = null;
  });

  pi.on("agent_start", async (_event, ctx) => {
    const sessionId = currentSessionId || `pi-${Date.now()}`;
    currentSessionId = sessionId;
    await sendHook({
      session_id: sessionId,
      hook_event_name: "UserPromptSubmit",
      cwd: ctx.cwd,
      source: "pi",
    });
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!currentSessionId) return;
    await sendHook({
      session_id: currentSessionId,
      hook_event_name: "Stop",
      cwd: ctx.cwd,
      source: "pi",
    });
  });

  pi.on("tool_call", async (event, ctx) => {
    const sessionId = currentSessionId || `pi-${Date.now()}`;
    currentSessionId = sessionId;
    await sendHook({
      session_id: sessionId,
      hook_event_name: "PreToolUse",
      tool_name: event.toolName,
      tool_input: event.input as Record<string, unknown> | undefined,
      cwd: ctx.cwd,
      source: "pi",
    });
  });
}
