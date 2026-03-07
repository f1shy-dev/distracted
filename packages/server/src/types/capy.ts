export type JamStatus = "idle" | "starting" | "continuing" | "acting";
export type TaskJamStatus = "backlog" | "in_progress" | "needs_review" | "archived";

export interface CapyJam {
  id: string;
  status: JamStatus;
  agentType?: "build" | "captain";
  projectId?: string | null;
  title?: string | null;
}

export interface CapySession {
  id: string;
  status: "idle" | "working" | "waiting_for_input";
  source: "capy";
  jamId: string;
}

export interface CapyAuthConfig {
  apiToken: string;
  baseUrl: string;
}

export interface CapyStatusResult {
  active: boolean;
  working: number;
  sessions: number;
  reason?: "invalid_token" | "server_error" | "offline" | "idle";
}
