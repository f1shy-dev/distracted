import type { HookPayload, ServerMessage, Session } from "./types";
import { SESSION_TIMEOUT_MS, USER_INPUT_TOOLS } from "./types";
import { UI } from "@/lib/ui";
import { getCapyStatus } from "./lib/capy-client";
import { isCapyConfigured } from "./setup/capy";

type StateChangeCallback = (message: ServerMessage) => void;
type StateMessage = Extract<ServerMessage, { type: "state" }>;

class SessionState {
  private sessions: Map<string, Session> = new Map();
  private listeners: Set<StateChangeCallback> = new Set();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private capyPollInterval: ReturnType<typeof setInterval> | null = null;
  private lastLoggedState:
    | { blocked: boolean; sessions: number; working: number; waitingForInput: number }
    | undefined = undefined;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 30_000);
  }

  subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    callback(this.getStateMessage());
    return () => this.listeners.delete(callback);
  }

  private broadcast(): void {
    const message = this.getStateMessage();
    for (const listener of this.listeners) listener(message);
  }

  private getStateMessage(): StateMessage {
    const sessions = Array.from(this.sessions.values());
    const working = sessions.filter((s) => s.status === "working").length;
    const waitingForInput = sessions.filter((s) => s.status === "waiting_for_input").length;
    return {
      type: "state",
      blocked: working === 0,
      sessions: sessions.length,
      working,
      waitingForInput,
    };
  }

  private logStatusIfChanged(): void {
    const message = this.getStateMessage();
    const next = {
      blocked: message.blocked,
      sessions: message.sessions,
      working: message.working,
      waitingForInput: message.waitingForInput,
    };
    const prev = this.lastLoggedState;
    if (
      prev &&
      prev.blocked === next.blocked &&
      prev.sessions === next.sessions &&
      prev.working === next.working &&
      prev.waitingForInput === next.waitingForInput
    ) {
      return;
    }
    this.lastLoggedState = next;
    UI.println(
      `Status: blocked=${next.blocked ? UI.Style.TEXT_DANGER : UI.Style.TEXT_SUCCESS}${next.blocked}${UI.Style.TEXT_NORMAL} sessions=${next.sessions} working=${next.working} waiting=${next.waitingForInput}`,
    );
  }

  handleHook(payload: HookPayload): void {
    const { session_id, hook_event_name } = payload;

    const beforeStatus = this.sessions.get(session_id)?.status;

    switch (hook_event_name) {
      case "SessionStart": {
        this.sessions.set(session_id, {
          id: session_id,
          status: "idle",
          lastActivity: new Date(),
          cwd: payload.cwd,
        });
        break;
      }

      case "SessionEnd": {
        this.sessions.delete(session_id);
        break;
      }

      case "UserPromptSubmit": {
        this.ensureSession(session_id, payload.cwd);
        const session = this.sessions.get(session_id)!;
        session.status = "working";
        session.waitingForInputSince = undefined;
        session.lastActivity = new Date();
        break;
      }

      case "PreToolUse": {
        this.ensureSession(session_id, payload.cwd);
        const session = this.sessions.get(session_id)!;

        if (payload.tool_name && USER_INPUT_TOOLS.includes(payload.tool_name)) {
          session.status = "waiting_for_input";
          session.waitingForInputSince = new Date();
        } else if (session.status === "waiting_for_input") {
          // If waiting for input, only reset after 500ms (ignore immediate tool calls like Edit)
          const elapsed = Date.now() - (session.waitingForInputSince?.getTime() ?? 0);
          if (elapsed > 500) {
            session.status = "working";
            session.waitingForInputSince = undefined;
          }
        } else {
          session.status = "working";
        }

        session.lastActivity = new Date();
        break;
      }

      case "Stop": {
        this.ensureSession(session_id, payload.cwd);
        const session = this.sessions.get(session_id)!;

        if (session.status === "waiting_for_input") {
          // Ignore immediate Stop after AskUserQuestion
          const elapsed = Date.now() - (session.waitingForInputSince?.getTime() ?? 0);
          if (elapsed > 500) {
            session.status = "idle";
            session.waitingForInputSince = undefined;
          }
        } else {
          session.status = "idle";
        }

        session.lastActivity = new Date();
        break;
      }
    }

    const afterStatus = this.sessions.get(session_id)?.status;
    if (
      hook_event_name === "SessionStart" ||
      hook_event_name === "SessionEnd" ||
      beforeStatus !== afterStatus
    ) {
      const toolSuffix = payload.tool_name ? ` tool=${payload.tool_name}` : "";
      UI.println(
        UI.Style.TEXT_DIM +
          `Hook: ${hook_event_name} session=${session_id}` +
          toolSuffix +
          ` status=${afterStatus ?? "none"}` +
          UI.Style.TEXT_NORMAL,
      );
    }
    this.logStatusIfChanged();

    this.broadcast();
  }

  private ensureSession(sessionId: string, cwd?: string): void {
    if (this.sessions.has(sessionId)) return;
    this.sessions.set(sessionId, {
      id: sessionId,
      status: "idle",
      lastActivity: new Date(),
      cwd,
    });
  }

  private cleanupStaleSessions(): void {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
        this.sessions.delete(id);
        removed++;
      }
    }

    if (removed > 0) this.broadcast();
  }

  async startCapyPolling(pollIntervalMs: number = 5000): Promise<void> {
    if (this.capyPollInterval) return;

    const configured = await isCapyConfigured();
    if (!configured) return;

    const sessionId = "capy-virtual-session";

    const pollCapy = async () => {
      const status = await getCapyStatus();
      UI.println(UI.Style.TEXT_DIM + `[capy] ${JSON.stringify(status)}` + UI.Style.TEXT_NORMAL);

      if (status.working > 0) {
        this.sessions.set(sessionId, {
          id: sessionId,
          status: "working",
          lastActivity: new Date(),
          cwd: undefined,
        });
      } else {
        const existing = this.sessions.get(sessionId);
        if (existing) {
          existing.status = "idle";
          existing.lastActivity = new Date();
        }
      }

      this.logStatusIfChanged();
      this.broadcast();
    };

    await pollCapy();

    this.capyPollInterval = setInterval(() => {
      void pollCapy();
    }, pollIntervalMs);
  }

  stopCapyPolling(): void {
    if (!this.capyPollInterval) return;
    clearInterval(this.capyPollInterval);
    this.capyPollInterval = null;
  }

  getStatus(): { blocked: boolean; sessions: Session[] } {
    const sessions = Array.from(this.sessions.values());
    const working = sessions.filter((s) => s.status === "working").length;
    return { blocked: working === 0, sessions };
  }

  destroy(): void {
    this.stopCapyPolling();
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.sessions.clear();
    this.listeners.clear();
  }
}

export const state = new SessionState();
