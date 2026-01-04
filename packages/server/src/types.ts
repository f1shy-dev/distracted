export interface HookPayload {
  session_id: string;
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "Stop" | "SessionStart" | "SessionEnd";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  transcript_path?: string;
  source?: "claude" | "opencode" | "capy";
}

export interface Session {
  id: string;
  status: "idle" | "working" | "waiting_for_input";
  lastActivity: Date;
  waitingForInputSince?: Date;
  cwd?: string;
}

export type ServerMessage =
  | {
      type: "state";
      blocked: boolean;
      sessions: number;
      working: number;
      waitingForInput: number;
    }
  | { type: "pong" };

export type ClientMessage = { type: "ping" } | { type: "subscribe" };

// Tools that indicate Claude is waiting for user input.
export const USER_INPUT_TOOLS = ["AskUserQuestion", "ask_user", "ask_human"];

export const DEFAULT_PORT = 8765;
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
