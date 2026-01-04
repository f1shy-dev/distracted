import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { UI } from "@/lib/ui";
import type { ClientMessage, HookPayload } from "./types";
import { DEFAULT_PORT } from "./types";
import { state } from "./state";

const app = new Hono();

const nodeWs = createNodeWebSocket({ app });

app.use("*", cors());

app.get(
  "/ws",
  nodeWs.upgradeWebSocket(() => {
    let unsubscribe: (() => void) | undefined = undefined;

    return {
      onOpen(evt, ws) {
        unsubscribe = state.subscribe((message) => {
          ws.send(JSON.stringify(message));
        });
      },
      onMessage: (event, ws) => {
        try {
          const text =
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data as ArrayBuffer);
          const message = JSON.parse(text) as ClientMessage;
          if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch {
          // ignore invalid messages
        }
      },
      onClose: () => {
        UI.println(UI.Style.TEXT_DIM + "Extension disconnected" + UI.Style.TEXT_NORMAL);
        unsubscribe?.();
      },
      onError: (event) => {
        UI.println(UI.Style.TEXT_DANGER_BOLD + "WebSocket error" + UI.Style.TEXT_NORMAL);
        UI.println(event instanceof Error ? (event.stack ?? event.message) : JSON.stringify(event));
        unsubscribe?.();
      },
    };
  }),
);

app.get("/status", (c) => {
  return c.json(state.getStatus());
});

app.post("/hook", async (c) => {
  try {
    const data = (await c.req.json()) as {
      session_id?: unknown;
      hook_event_name?: unknown;
      tool_name?: unknown;
      tool_input?: unknown;
      cwd?: unknown;
      transcript_path?: unknown;
      source?: unknown;
    };

    if (!data || typeof data.session_id !== "string" || typeof data.hook_event_name !== "string") {
      return c.json({ error: "Invalid payload" }, 400);
    }

    const allowedEvents: HookPayload["hook_event_name"][] = [
      "UserPromptSubmit",
      "PreToolUse",
      "Stop",
      "SessionStart",
      "SessionEnd",
    ];
    if (!allowedEvents.includes(data.hook_event_name as HookPayload["hook_event_name"])) {
      return c.json({ error: "Invalid payload" }, 400);
    }

    const payload: HookPayload = {
      session_id: data.session_id,
      hook_event_name: data.hook_event_name as HookPayload["hook_event_name"],
      tool_name: typeof data.tool_name === "string" ? data.tool_name : undefined,
      tool_input:
        data.tool_input && typeof data.tool_input === "object"
          ? (data.tool_input as Record<string, unknown>)
          : undefined,
      cwd: typeof data.cwd === "string" ? data.cwd : undefined,
      transcript_path: typeof data.transcript_path === "string" ? data.transcript_path : undefined,
      source:
        data.source === "claude" || data.source === "opencode"
          ? (data.source as HookPayload["source"])
          : undefined,
    };

    state.handleHook(payload);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export function startServer(port: number = DEFAULT_PORT): void {
  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Distracted Server" + UI.Style.TEXT_NORMAL);
      UI.println(
        UI.Style.TEXT_INFO + `HTTP:      http://localhost:${info.port}` + UI.Style.TEXT_NORMAL,
      );
      UI.println(
        UI.Style.TEXT_INFO + `WebSocket: ws://localhost:${info.port}/ws` + UI.Style.TEXT_NORMAL,
      );
      UI.println(UI.Style.TEXT_DIM + "Waiting for AI agent hooks..." + UI.Style.TEXT_NORMAL);
      UI.empty();
    },
  );

  nodeWs.injectWebSocket(server);

  process.once("SIGINT", () => {
    UI.empty();
    UI.println(UI.Style.TEXT_DIM + "Shutting down..." + UI.Style.TEXT_NORMAL);
    try {
      state.destroy();
      server.close();
    } finally {
      process.exit(0);
    }
  });
}
