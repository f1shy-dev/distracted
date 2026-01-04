import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { UI } from "@/lib/ui";
import { DEFAULT_PORT } from "../types";

const ClaudeSettingsSchema = z
  .object({
    hooks: z.record(z.string(), z.array(z.unknown())).optional(),
  })
  .catchall(z.unknown());

function makeHooksConfig(port: number): Record<string, unknown[]> {
  const HOOK_COMMAND = `curl -s -X POST http://localhost:${port}/hook -H 'Content-Type: application/json' -d "$(cat)" > /dev/null 2>&1 &`;
  return {
    UserPromptSubmit: [
      {
        hooks: [{ type: "command", command: HOOK_COMMAND }],
      },
    ],
    PreToolUse: [
      {
        matcher: "*",
        hooks: [{ type: "command", command: HOOK_COMMAND }],
      },
    ],
    Stop: [
      {
        hooks: [{ type: "command", command: HOOK_COMMAND }],
      },
    ],
    SessionStart: [
      {
        hooks: [{ type: "command", command: HOOK_COMMAND }],
      },
    ],
    SessionEnd: [
      {
        hooks: [{ type: "command", command: HOOK_COMMAND }],
      },
    ],
  };
}

async function readClaudeSettings(
  settingsPath: string,
): Promise<z.infer<typeof ClaudeSettingsSchema> | null> {
  try {
    const content = await readFile(settingsPath, "utf-8");
    const raw = JSON.parse(content) as unknown;
    const parsed = ClaudeSettingsSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data as z.infer<typeof ClaudeSettingsSchema>;
  } catch {
    return null;
  }
}

export async function setupClaude(port: number = DEFAULT_PORT): Promise<void> {
  const claudeDir = join(homedir(), ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  await mkdir(claudeDir, { recursive: true });

  const settings = (await readClaudeSettings(settingsPath)) ?? {};
  const hooksConfig = makeHooksConfig(port);

  settings.hooks = {
    ...settings.hooks,
    ...hooksConfig,
  };

  await writeFile(settingsPath, JSON.stringify(settings, null, 2));

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Claude Code hooks configured." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Path: ${settingsPath}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Port: ${port}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + "Next: Run 'bunx @distracted/server'" + UI.Style.TEXT_NORMAL);
  UI.empty();
}

export async function isClaudeConfigured(): Promise<boolean> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const settings = await readClaudeSettings(settingsPath);
  if (!settings) return false;
  if (!settings.hooks) return false;

  const hooks = settings.hooks;
  const keys = Object.keys(makeHooksConfig(DEFAULT_PORT));
  return keys.some((hookName) => hookName in hooks);
}

export async function removeClaude(): Promise<void> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const settings = await readClaudeSettings(settingsPath);
  if (!settings) {
    UI.println(
      UI.Style.TEXT_DIM + "No settings.json found, nothing to remove." + UI.Style.TEXT_NORMAL,
    );
    return;
  }
  if (!settings.hooks) {
    UI.println(UI.Style.TEXT_DIM + "No hooks found in settings.json" + UI.Style.TEXT_NORMAL);
    return;
  }

  for (const hookName of Object.keys(makeHooksConfig(DEFAULT_PORT))) {
    delete settings.hooks[hookName];
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Claude Code hooks removed." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Path: ${settingsPath}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}
