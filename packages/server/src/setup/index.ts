import { emitKeypressEvents } from "node:readline";

import { UI } from "@/lib/ui";

type AgentType = "claude" | "opencode";

type SetupStatus = {
  claude: boolean;
  opencode: boolean;
};
import { isClaudeConfigured, removeClaude, setupClaude } from "./claude";
import { isOpenCodeConfigured, removeOpenCode, setupOpenCode } from "./opencode";

const AGENT_OPTIONS: { id: AgentType; label: string }[] = [
  { id: "claude", label: "Claude Code (~/.claude/settings.json hooks)" },
  { id: "opencode", label: "OpenCode (~/.config/opencode/plugin/)" },
];

async function selectAgents(prompt: string, defaultSelected: AgentType[]): Promise<AgentType[]> {
  if (!process.stdin.isTTY) {
    UI.println(UI.Style.TEXT_DIM + "Non-interactive shell detected." + UI.Style.TEXT_NORMAL);
    return [];
  }

  let cursor = 0;
  const selected = new Set<AgentType>(defaultSelected);

  const render = () => {
    process.stderr.write("\x1b[2J\x1b[H");
    UI.println(prompt);
    UI.empty();

    for (let i = 0; i < AGENT_OPTIONS.length; i++) {
      const opt = AGENT_OPTIONS[i];
      const isSelected = selected.has(opt.id);
      const prefix = i === cursor ? UI.Style.TEXT_HIGHLIGHT_BOLD + ">" + UI.Style.TEXT_NORMAL : " ";
      const checkbox = isSelected ? "[x]" : "[ ]";
      UI.println(`${prefix} ${checkbox} ${opt.label}`);
    }

    UI.empty();
    UI.println(
      UI.Style.TEXT_DIM +
        "Use ↑/↓ to move, space to toggle, enter to confirm" +
        UI.Style.TEXT_NORMAL,
    );
  };

  emitKeypressEvents(process.stdin);
  const previousRawMode = process.stdin.isRaw ?? false;
  process.stdin.setRawMode(true);
  process.stdin.resume();

  render();

  return new Promise((resolve, reject) => {
    const onKeypress = (_str: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new UI.CancelledError(undefined));
        return;
      }

      if (key.name === "up") {
        cursor = (cursor - 1 + AGENT_OPTIONS.length) % AGENT_OPTIONS.length;
        render();
        return;
      }

      if (key.name === "down") {
        cursor = (cursor + 1) % AGENT_OPTIONS.length;
        render();
        return;
      }

      if (key.name === "space") {
        const id = AGENT_OPTIONS[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
        return;
      }

      if (key.name === "return") {
        const result = Array.from(selected);
        if (result.length === 0) {
          render();
          UI.empty();
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "Select at least one agent." + UI.Style.TEXT_NORMAL,
          );
          return;
        }
        cleanup();
        resolve(result);
      }
    };

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(previousRawMode);
      process.stdin.pause();
      process.stderr.write("\x1b[2J\x1b[H");
    };

    process.stdin.on("keypress", onKeypress);
  });
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const [claude, opencode] = await Promise.all([isClaudeConfigured(), isOpenCodeConfigured()]);
  return { claude, opencode };
}

export async function setupAgent(agent: AgentType, port: number): Promise<void> {
  if (agent === "claude") {
    await setupClaude(port);
    return;
  }
  await setupOpenCode(port);
}

export async function removeAgent(agent: AgentType): Promise<void> {
  if (agent === "claude") {
    await removeClaude();
    return;
  }
  await removeOpenCode();
}

export async function interactiveSetup(port: number): Promise<void> {
  const agents = await selectAgents(
    "? Select AI coding agent(s) to configure:",
    AGENT_OPTIONS.map((o) => o.id),
  );

  for (const agent of agents) {
    await setupAgent(agent, port);
  }
}

export async function interactiveRemove(): Promise<void> {
  const status = await getSetupStatus();
  const defaultSelected = AGENT_OPTIONS.filter((o) => status[o.id]).map((o) => o.id);

  if (defaultSelected.length === 0) {
    UI.println(UI.Style.TEXT_DIM + "No agents are configured." + UI.Style.TEXT_NORMAL);
    return;
  }

  if (!process.stdin.isTTY) {
    UI.println(UI.Style.TEXT_DIM + "Non-interactive shell detected." + UI.Style.TEXT_NORMAL);
    UI.println("Run with '--remove claude', '--remove opencode', or '--remove all'.");
    return;
  }

  const agents = await selectAgents("? Select AI coding agent(s) to remove:", defaultSelected);

  for (const agent of agents) {
    await removeAgent(agent);
  }
}
