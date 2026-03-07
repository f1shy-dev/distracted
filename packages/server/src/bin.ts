import * as p from "@clack/prompts";
import pc from "picocolors";

import { UI } from "@/lib/ui";
import { startServer } from "./server";
import {
  getSetupStatus,
  interactiveRemove,
  interactiveSetup,
  removeAgent,
  setupAgent,
  type AgentType,
} from "./setup/index";
import { DEFAULT_PORT } from "./types";

const ALL_AGENTS: AgentType[] = ["claude", "opencode", "gemini", "cursor", "cline"];

const args = process.argv.slice(2);

function getFlag(name: string): boolean {
  return args.includes(`--${name}`) || args.some((arg) => arg.startsWith(`--${name}=`));
}

function getFlagValue(name: string): string | undefined {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`));
  if (equalsArg) {
    const value = equalsArg.slice(`--${name}=`.length);
    return value.length > 0 ? value : undefined;
  }

  const idx = args.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function showHelp(): void {
  p.log.info("Usage: bunx @distracted/server [options]");
  p.log.info("  --setup [agent]   Configure hooks (claude, opencode, gemini, cursor, cline, all)");
  p.log.info("  --remove [agent]  Remove hooks (claude, opencode, gemini, cursor, cline, all)");
  p.log.info("  --status          Show configured hook status");
  p.log.info(`  --port <port>     Server port (default: ${DEFAULT_PORT})`);
  p.log.info("  --help            Show help");
}

function parseAgentSelection(input: string | undefined): AgentType[] | null {
  if (!input) return null;

  const normalized = input.trim().toLowerCase();
  if (normalized === "all") {
    return [...ALL_AGENTS];
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return [];

  const values = new Set<AgentType>();
  for (const part of parts) {
    if (ALL_AGENTS.includes(part as AgentType)) {
      values.add(part as AgentType);
    } else {
      return [];
    }
  }

  return [...values];
}

async function main(): Promise<void> {
  const hasHelp = getFlag("help") || args.includes("-h");
  if (hasHelp) {
    showHelp();
    return;
  }

  const hasPort = getFlag("port");
  const portValue = getFlagValue("port");
  if (hasPort && portValue === undefined) {
    UI.error("--port requires a value.");
    process.exit(1);
  }

  const port = Number(portValue ?? DEFAULT_PORT);
  if (!Number.isFinite(port) || port <= 0 || port >= 65536) {
    UI.error("Invalid port number.");
    process.exit(1);
  }

  const hasSetup = getFlag("setup");
  const hasRemove = getFlag("remove");
  const hasStatus = getFlag("status");

  const modeCount = [hasSetup, hasRemove, hasStatus].filter(Boolean).length;
  if (modeCount > 1) {
    UI.error("Use only one of --setup, --remove, or --status.");
    process.exit(1);
  }

  if (hasStatus) {
    const status = await getSetupStatus();
    p.log.info(pc.bold("Setup status"));

    for (const agent of ALL_AGENTS) {
      p.log.info(
        `${agent.padEnd(8)} ${status[agent] ? pc.green("configured") : pc.yellow("not configured")}`,
      );
    }
    return;
  }

  if (hasSetup) {
    const agents = parseAgentSelection(getFlagValue("setup"));
    if (agents && agents.length === 0) {
      UI.error("Invalid agent. Use: claude, opencode, gemini, cursor, cline, all.");
      process.exit(1);
    }

    p.intro(pc.bgCyan(pc.black(" distracted ")));
    if (!agents) {
      const didSetup = await interactiveSetup(port);
      if (didSetup) {
        p.outro("Done! Run 'bunx @distracted/server' to start.");
      }
    } else {
      for (const agent of agents) {
        await setupAgent(agent, port);
      }
      p.outro("Done! Run 'bunx @distracted/server' to start.");
    }
    return;
  }

  if (hasRemove) {
    const agents = parseAgentSelection(getFlagValue("remove"));
    if (agents && agents.length === 0) {
      UI.error("Invalid agent. Use: claude, opencode, gemini, cursor, cline, all.");
      process.exit(1);
    }

    p.intro(pc.bgCyan(pc.black(" distracted ")));
    if (!agents) {
      const didRemove = await interactiveRemove();
      if (didRemove) {
        p.outro("Hook cleanup complete.");
      }
    } else {
      for (const agent of agents) {
        await removeAgent(agent);
      }
      p.outro("Hook cleanup complete.");
    }
    return;
  }

  const status = await getSetupStatus();
  const hasConfiguredAgent = ALL_AGENTS.some((agent) => status[agent]);

  if (!hasConfiguredAgent) {
    p.log.warn("No AI agent hooks configured.");

    if (!process.stdin.isTTY) {
      p.log.info(pc.dim("Non-interactive shell detected; skipping setup prompt."));
      p.log.info("Run 'bunx @distracted/server --setup' to configure hooks.");
    } else {
      const shouldSetup = await p.confirm({
        message: "No AI agent hooks configured. Set them up now?",
      });

      if (p.isCancel(shouldSetup)) {
        p.cancel("Cancelled.");
        process.exit(0);
      }

      if (shouldSetup) {
        p.intro(pc.bgCyan(pc.black(" distracted ")));
        const didSetup = await interactiveSetup(port);
        if (didSetup) {
          p.outro("Setup complete.");
        }
      } else {
        p.log.info("Skipping setup. You can run 'bunx @distracted/server --setup' later.");
      }
    }
  }

  startServer(port);
}

void main();
