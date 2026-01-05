import { cac } from "cac";
import { UI } from "@/lib/ui";
import { DEFAULT_PORT } from "./types";
import {
  getSetupStatus,
  interactiveRemove,
  interactiveSetup,
  removeAgent,
  setupAgent,
} from "./setup/index";
import { startServer } from "./server";

type AgentType = Parameters<typeof setupAgent>[0];

function parseAgentSelection(input: unknown): AgentType[] | null {
  if (input === true || input === undefined) return null;
  if (typeof input !== "string") return null;

  const normalized = input.trim().toLowerCase();
  if (normalized === "all") return ["claude", "opencode", "capy"];
  if (normalized === "claude") return ["claude"];
  if (normalized === "opencode") return ["opencode"];
  if (normalized === "capy") return ["capy"];
  return [];
}

async function main(): Promise<void> {
  const cli = cac("distracted-server");
  cli
    .option("--setup [agent]", "Configure AI coding agent hooks (claude, opencode, capy, all)")
    .option("--remove [agent]", "Remove AI coding agent hooks (claude, opencode, capy, all)")
    .option("--status", "Show which agents are configured")
    .option("--port <port>", `Server port (default: ${DEFAULT_PORT})`, {
      default: DEFAULT_PORT,
    })
    .help();

  const parsed = cli.parse();
  const options = parsed.options as {
    setup?: unknown;
    remove?: unknown;
    status?: boolean;
    port: unknown;
    help?: boolean;
  };

  if (options.help) {
    process.exit(0);
  }

  const port = Number(options.port);
  if (!Number.isFinite(port) || port <= 0 || port >= 65536) {
    UI.error("Invalid port number");
    process.exit(1);
  }

  const hasSetup = options.setup !== undefined;
  const hasRemove = options.remove !== undefined;
  const hasStatus = options.status === true;

  const modeCount = [hasSetup, hasRemove, hasStatus].filter(Boolean).length;
  if (modeCount > 1) {
    UI.error("Use only one of --setup, --remove, or --status");
    process.exit(1);
  }

  if (hasStatus) {
    const status = await getSetupStatus();
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Setup status" + UI.Style.TEXT_NORMAL);
    UI.println(
      UI.Style.TEXT_DIM +
        `Claude Code: ${status.claude ? "configured" : "not configured"}` +
        UI.Style.TEXT_NORMAL,
    );
    UI.println(
      UI.Style.TEXT_DIM +
        `OpenCode:    ${status.opencode ? "configured" : "not configured"}` +
        UI.Style.TEXT_NORMAL,
    );
    UI.println(
      UI.Style.TEXT_DIM +
        `Capy:        ${status.capy ? "configured" : "not configured"}` +
        UI.Style.TEXT_NORMAL,
    );
    UI.empty();
    process.exit(0);
  }

  if (hasSetup) {
    const agents = parseAgentSelection(options.setup);
    if (agents && agents.length === 0) {
      UI.error("Invalid agent. Use: claude, opencode, capy, all");
      process.exit(1);
    }

    if (!agents) {
      try {
        await interactiveSetup(port);
      } catch (err) {
        if (err instanceof Error && err.name === "UICancelledError") {
          UI.empty();
          UI.println(UI.Style.TEXT_DIM + "Cancelled." + UI.Style.TEXT_NORMAL);
          UI.empty();
        } else {
          throw err;
        }
      }
      process.exit(0);
    }

    for (const agent of agents) {
      await setupAgent(agent, port);
    }

    process.exit(0);
  }

  if (hasRemove) {
    const agents = parseAgentSelection(options.remove);
    if (agents && agents.length === 0) {
      UI.error("Invalid agent. Use: claude, opencode, capy, all");
      process.exit(1);
    }

    if (!agents) {
      try {
        await interactiveRemove();
      } catch (err) {
        if (err instanceof Error && err.name === "UICancelledError") {
          UI.empty();
          UI.println(UI.Style.TEXT_DIM + "Cancelled." + UI.Style.TEXT_NORMAL);
          UI.empty();
        } else {
          throw err;
        }
      }
      process.exit(0);
    }

    for (const agent of agents) {
      await removeAgent(agent);
    }

    process.exit(0);
  }

  const status = await getSetupStatus();
  if (!status.claude && !status.opencode && !status.capy) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "No AI agent hooks are configured yet." + UI.Style.TEXT_NORMAL,
    );
    UI.empty();

    if (!process.stdin.isTTY) {
      UI.println(
        UI.Style.TEXT_DIM +
          "Non-interactive shell detected; skipping setup prompt." +
          UI.Style.TEXT_NORMAL,
      );
      UI.println("Run 'bunx @distracted/server --setup' to configure hooks.");
      UI.empty();
    } else {
      const answer = await UI.input("Would you like to set them up now? (Y/n) ");
      const normalized = answer.trim().toLowerCase();
      if (normalized === "" || normalized === "y" || normalized === "yes") {
        try {
          await interactiveSetup(port);
        } catch (err) {
          if (err instanceof Error && err.name === "UICancelledError") {
            UI.empty();
            UI.println(UI.Style.TEXT_DIM + "Cancelled." + UI.Style.TEXT_NORMAL);
            UI.empty();
          } else {
            throw err;
          }
        }
        UI.empty();
      } else {
        UI.empty();
        UI.println("Skipping setup. You can run 'bunx @distracted/server --setup' later.");
        UI.empty();
      }
    }
  }

  startServer(port);
}

void main();
