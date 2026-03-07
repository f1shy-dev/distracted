import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

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

  p.log.success("Claude Code hooks configured.");
  p.log.info(`Path: ${pc.dim(settingsPath)}`);
  p.log.info(`Port: ${pc.dim(String(port))}`);
  p.log.info(`Next: ${pc.dim("Run 'bunx @distracted/server'")}`);
}

export async function isClaudeConfigured(): Promise<boolean> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const settings = await readClaudeSettings(settingsPath);
  if (!settings || !settings.hooks) return false;

  const keys = Object.keys(makeHooksConfig(DEFAULT_PORT));
  return keys.some((hookName) => hookName in settings.hooks!);
}

export async function removeClaude(): Promise<void> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const settings = await readClaudeSettings(settingsPath);

  if (!settings) {
    p.log.info("No settings.json found, nothing to remove.");
    return;
  }

  if (!settings.hooks) {
    p.log.info("No hooks found in settings.json.");
    return;
  }

  for (const hookName of Object.keys(makeHooksConfig(DEFAULT_PORT))) {
    delete settings.hooks[hookName];
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  p.log.success("Claude Code hooks removed.");
  p.log.info(`Path: ${pc.dim(settingsPath)}`);
}
