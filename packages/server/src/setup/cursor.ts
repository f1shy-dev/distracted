import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { DEFAULT_PORT } from "../types";

const CURSOR_DIR = join(homedir(), ".cursor");
const CURSOR_HOOKS_PATH = join(CURSOR_DIR, "hooks.json");

const CursorHookSchema = z
  .object({
    event: z.string().optional(),
    command: z.string().optional(),
    matcher: z.string().optional(),
  })
  .catchall(z.unknown());

const CursorHooksFileSchema = z
  .object({
    hooks: z
      .object({
        agent: z
          .object({
            preToolUse: z.array(CursorHookSchema).optional(),
            postToolUse: z.array(CursorHookSchema).optional(),
            stop: z.array(CursorHookSchema).optional(),
            sessionStart: z.array(CursorHookSchema).optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
  })
  .catchall(z.unknown());

function makeHookCommand(port: number, hookEventName: string): string {
  const TRANSFORM_COMMAND =
    `node -e 'let d="";process.stdin.on("data",(c)=>d+=c);process.stdin.on("end",()=>{` +
    `try{const j=JSON.parse(d||"{}");j.hook_event_name="${hookEventName}";j.source="cursor";process.stdout.write(JSON.stringify(j));}` +
    `catch{process.stdout.write("{}");}});'`;
  return `${TRANSFORM_COMMAND} | curl -s -X POST http://localhost:${port}/hook -H 'Content-Type: application/json' -d "$(cat)" > /dev/null 2>&1 &`;
}

function makeHooksConfig(
  port: number,
): NonNullable<NonNullable<z.infer<typeof CursorHooksFileSchema>["hooks"]>["agent"]> {
  return {
    sessionStart: [
      {
        event: "sessionStart",
        command: makeHookCommand(port, "SessionStart"),
      },
    ],
    preToolUse: [
      {
        event: "preToolUse",
        command: makeHookCommand(port, "PreToolUse"),
        matcher: "*",
      },
    ],
    stop: [
      {
        event: "stop",
        command: makeHookCommand(port, "Stop"),
      },
    ],
  };
}

async function readCursorHooks(
  path: string,
): Promise<z.infer<typeof CursorHooksFileSchema> | null> {
  try {
    const content = await readFile(path, "utf-8");
    const raw = JSON.parse(content) as unknown;
    const parsed = CursorHooksFileSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data as z.infer<typeof CursorHooksFileSchema>;
  } catch {
    return null;
  }
}

export async function setupCursor(port: number = DEFAULT_PORT): Promise<void> {
  await mkdir(CURSOR_DIR, { recursive: true });

  const config = (await readCursorHooks(CURSOR_HOOKS_PATH)) ?? {};
  const hooksConfig = makeHooksConfig(port);

  config.hooks = config.hooks ?? {};
  config.hooks.agent = {
    ...config.hooks.agent,
    ...hooksConfig,
  };

  await writeFile(CURSOR_HOOKS_PATH, JSON.stringify(config, null, 2));

  p.log.success("Cursor hooks configured.");
  p.log.info(`Path: ${pc.dim(CURSOR_HOOKS_PATH)}`);
  p.log.info(`Port: ${pc.dim(String(port))}`);
}

export async function isCursorConfigured(): Promise<boolean> {
  const config = await readCursorHooks(CURSOR_HOOKS_PATH);
  const agentHooks = config?.hooks?.agent;
  if (!agentHooks) return false;

  return Boolean(agentHooks.sessionStart || agentHooks.preToolUse || agentHooks.stop);
}

export async function removeCursor(): Promise<void> {
  const config = await readCursorHooks(CURSOR_HOOKS_PATH);
  if (!config) {
    p.log.info("No Cursor hooks.json found, nothing to remove.");
    return;
  }

  if (!config.hooks?.agent) {
    p.log.info("No Cursor agent hooks found.");
    return;
  }

  delete config.hooks.agent.sessionStart;
  delete config.hooks.agent.preToolUse;
  delete config.hooks.agent.stop;

  if (Object.keys(config.hooks.agent).length === 0) {
    delete config.hooks.agent;
  }

  if (config.hooks && Object.keys(config.hooks).length === 0) {
    delete config.hooks;
  }

  await writeFile(CURSOR_HOOKS_PATH, JSON.stringify(config, null, 2));
  p.log.success("Cursor hooks removed.");
  p.log.info(`Path: ${pc.dim(CURSOR_HOOKS_PATH)}`);
}
