import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { DEFAULT_PORT } from "../types";

const GEMINI_DIR = join(homedir(), ".gemini");
const GEMINI_SETTINGS_PATH = join(GEMINI_DIR, "settings.json");

const GeminiSettingsSchema = z
  .object({
    hooks: z.record(z.string(), z.array(z.unknown())).optional(),
  })
  .catchall(z.unknown());

function makeHookCommand(port: number, hookEventName: string): string {
  const TRANSFORM_COMMAND =
    `node -e 'let d="";process.stdin.on("data",(c)=>d+=c);process.stdin.on("end",()=>{` +
    `try{const j=JSON.parse(d||"{}");j.hook_event_name="${hookEventName}";j.source="gemini";process.stdout.write(JSON.stringify(j));}` +
    `catch{process.stdout.write("{}");}});'`;
  return `${TRANSFORM_COMMAND} | curl -s -X POST http://localhost:${port}/hook -H 'Content-Type: application/json' -d "$(cat)" > /dev/null 2>&1 &`;
}

function makeHooksConfig(port: number): Record<string, unknown[]> {
  return {
    BeforeAgent: [
      {
        hooks: [{ type: "command", command: makeHookCommand(port, "UserPromptSubmit") }],
      },
    ],
    BeforeTool: [
      {
        matcher: ".*",
        hooks: [{ type: "command", command: makeHookCommand(port, "PreToolUse") }],
      },
    ],
    SessionStart: [
      {
        hooks: [{ type: "command", command: makeHookCommand(port, "SessionStart") }],
      },
    ],
    SessionEnd: [
      {
        hooks: [{ type: "command", command: makeHookCommand(port, "SessionEnd") }],
      },
    ],
    AfterAgent: [
      {
        hooks: [{ type: "command", command: makeHookCommand(port, "Stop") }],
      },
    ],
  };
}

async function readGeminiSettings(
  settingsPath: string,
): Promise<z.infer<typeof GeminiSettingsSchema> | null> {
  try {
    const content = await readFile(settingsPath, "utf-8");
    const raw = JSON.parse(content) as unknown;
    const parsed = GeminiSettingsSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data as z.infer<typeof GeminiSettingsSchema>;
  } catch {
    return null;
  }
}

export async function setupGemini(port: number = DEFAULT_PORT): Promise<void> {
  await mkdir(GEMINI_DIR, { recursive: true });

  const settings = (await readGeminiSettings(GEMINI_SETTINGS_PATH)) ?? {};
  const hooksConfig = makeHooksConfig(port);

  settings.hooks = {
    ...settings.hooks,
    ...hooksConfig,
  };

  await writeFile(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2));

  p.log.success("Gemini CLI hooks configured.");
  p.log.info(`Path: ${pc.dim(GEMINI_SETTINGS_PATH)}`);
  p.log.info(`Port: ${pc.dim(String(port))}`);
}

export async function isGeminiConfigured(): Promise<boolean> {
  const settings = await readGeminiSettings(GEMINI_SETTINGS_PATH);
  if (!settings || !settings.hooks) return false;

  const keys = Object.keys(makeHooksConfig(DEFAULT_PORT));
  return keys.some((hookName) => hookName in settings.hooks!);
}

export async function removeGemini(): Promise<void> {
  const settings = await readGeminiSettings(GEMINI_SETTINGS_PATH);

  if (!settings) {
    p.log.info("No Gemini settings.json found, nothing to remove.");
    return;
  }

  if (!settings.hooks) {
    p.log.info("No Gemini hooks found in settings.json.");
    return;
  }

  for (const hookName of Object.keys(makeHooksConfig(DEFAULT_PORT))) {
    delete settings.hooks[hookName];
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  await writeFile(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2));
  p.log.success("Gemini CLI hooks removed.");
  p.log.info(`Path: ${pc.dim(GEMINI_SETTINGS_PATH)}`);
}
