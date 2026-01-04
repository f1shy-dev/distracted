import { cac } from "cac";
import { UI } from "@/lib/ui";
import { DEFAULT_PORT } from "./types";
import { areHooksConfigured, removeHooks, setupHooks } from "./setup";
import { startServer } from "./server";

async function main(): Promise<void> {
  const cli = cac("distracted-server");
  cli
    .option("--setup", "Configure Claude Code hooks (~/.claude/settings.json)")
    .option("--remove", "Remove Claude Code hooks")
    .option("--port <port>", `Server port (default: ${DEFAULT_PORT})`, {
      default: DEFAULT_PORT,
    })
    .help();

  const parsed = cli.parse();
  const options = parsed.options as { setup?: boolean; remove?: boolean; port: unknown };

  const port = Number(options.port);
  if (!Number.isFinite(port) || port <= 0 || port >= 65536) {
    UI.error("Invalid port number");
    process.exit(1);
  }

  if (options.setup) {
    await setupHooks(port);
    process.exit(0);
  }

  if (options.remove) {
    await removeHooks();
    process.exit(0);
  }

  if (!(await areHooksConfigured())) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD +
        "Claude Code hooks are not configured yet." +
        UI.Style.TEXT_NORMAL,
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
        await setupHooks(port);
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
