import * as p from "@clack/prompts";
import pc from "picocolors";

import { isClaudeConfigured, removeClaude, setupClaude } from "./claude";
import { isClineConfigured, removeCline, setupCline } from "./cline";
import { isCursorConfigured, removeCursor, setupCursor } from "./cursor";
import { isGeminiConfigured, removeGemini, setupGemini } from "./gemini";
import { isOpenCodeConfigured, removeOpenCode, setupOpenCode } from "./opencode";

export type AgentType = "claude" | "opencode" | "gemini" | "cursor" | "cline";

type SetupStatus = Record<AgentType, boolean>;

const AGENT_OPTIONS: { id: AgentType; label: string; description: string }[] = [
  { id: "claude", label: "Claude Code", description: "~/.claude/settings.json hooks" },
  { id: "opencode", label: "OpenCode", description: "~/.config/opencode/plugin/" },
  { id: "gemini", label: "Gemini CLI", description: "~/.gemini/settings.json hooks" },
  { id: "cursor", label: "Cursor", description: "~/.cursor/hooks.json" },
  { id: "cline", label: "Cline", description: "~/Documents/Cline/Rules/Hooks/ scripts" },
];

async function selectAgents(prompt: string, defaultSelected: AgentType[]): Promise<AgentType[]> {
  const result = await p.multiselect({
    message: prompt,
    options: AGENT_OPTIONS.map((option) => ({
      value: option.id,
      label: option.label,
      hint: option.description,
    })),
    initialValues: defaultSelected,
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  return result as AgentType[];
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const [claude, opencode, gemini, cursor, cline] = await Promise.all([
    isClaudeConfigured(),
    isOpenCodeConfigured(),
    isGeminiConfigured(),
    isCursorConfigured(),
    isClineConfigured(),
  ]);

  return { claude, opencode, gemini, cursor, cline };
}

export async function setupAgent(agent: AgentType, port: number): Promise<void> {
  switch (agent) {
    case "claude":
      await setupClaude(port);
      break;
    case "opencode":
      await setupOpenCode(port);
      break;
    case "gemini":
      await setupGemini(port);
      break;
    case "cursor":
      await setupCursor(port);
      break;
    case "cline":
      await setupCline(port);
      break;
  }
}

export async function removeAgent(agent: AgentType): Promise<void> {
  switch (agent) {
    case "claude":
      await removeClaude();
      break;
    case "opencode":
      await removeOpenCode();
      break;
    case "gemini":
      await removeGemini();
      break;
    case "cursor":
      await removeCursor();
      break;
    case "cline":
      await removeCline();
      break;
  }
}

export async function interactiveSetup(port: number): Promise<boolean> {
  if (!process.stdin.isTTY) {
    p.log.warn(`Non-interactive shell detected. ${pc.dim("Use --setup <agent> or --setup all")}`);
    return false;
  }

  const agents = await selectAgents(
    "Select AI coding agent(s) to configure:",
    AGENT_OPTIONS.map((option) => option.id),
  );

  for (const agent of agents) {
    await setupAgent(agent, port);
  }

  return true;
}

export async function interactiveRemove(): Promise<boolean> {
  const status = await getSetupStatus();
  const defaultSelected = AGENT_OPTIONS.filter((option) => status[option.id]).map(
    (option) => option.id,
  );

  if (defaultSelected.length === 0) {
    p.log.info("No agents are configured.");
    return false;
  }

  if (!process.stdin.isTTY) {
    p.log.warn(`Non-interactive shell detected. ${pc.dim("Use --remove <agent> or --remove all")}`);
    return false;
  }

  const agents = await selectAgents("Select AI coding agent(s) to remove:", defaultSelected);

  for (const agent of agents) {
    await removeAgent(agent);
  }

  return true;
}
