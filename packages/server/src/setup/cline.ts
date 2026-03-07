import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { DEFAULT_PORT } from "../types";

const CLINE_HOOKS_DIR = join(homedir(), "Documents", "Cline", "Rules", "Hooks");
const MARKER = "// @distracted/server hook";

const SCRIPT_EVENT_MAP = {
  PreToolUse: ["PreToolUse"],
  UserPromptSubmit: ["UserPromptSubmit"],
  TaskStart: ["SessionStart"],
  TaskComplete: ["Stop", "SessionEnd"],
} as const;

type ScriptName = keyof typeof SCRIPT_EVENT_MAP;

function makeScript(port: number, events: readonly string[]): string {
  return `#!/usr/bin/env node
${MARKER}
let inputData = "";
process.stdin.on("data", (chunk) => {
  inputData += chunk;
});
process.stdin.on("end", async () => {
  try {
    const input = inputData.trim() ? JSON.parse(inputData) : {};
    const sessionId =
      typeof input.taskId === "string" && input.taskId.length > 0
        ? input.taskId
        : \`cline-\${Date.now()}\`;
    const workspaceRoots = Array.isArray(input.workspaceRoots) ? input.workspaceRoots : [];
    const cwd = typeof workspaceRoots[0] === "string" ? workspaceRoots[0] : undefined;
    const toolName =
      typeof input.tool_name === "string"
        ? input.tool_name
        : typeof input.toolName === "string"
          ? input.toolName
          : typeof input.tool === "string"
            ? input.tool
            : undefined;
    const toolInput =
      input.tool_input && typeof input.tool_input === "object"
        ? input.tool_input
        : input.toolInput && typeof input.toolInput === "object"
          ? input.toolInput
          : undefined;

    const requests = [];
    for (const eventName of ${JSON.stringify(events)}) {
      const payload = {
        session_id: sessionId,
        hook_event_name: eventName,
        tool_name: toolName,
        tool_input: toolInput,
        cwd,
        source: "cline",
      };

      requests.push(
        fetch("http://localhost:${port}/hook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
    }

    await Promise.allSettled(requests);
  } catch {
  }

  process.stdout.write("{}\\n");
});
`;
}

async function hasMarker(path: string): Promise<boolean> {
  try {
    const content = await readFile(path, "utf-8");
    return content.includes(MARKER);
  } catch {
    return false;
  }
}

export async function setupCline(port: number = DEFAULT_PORT): Promise<void> {
  await mkdir(CLINE_HOOKS_DIR, { recursive: true });

  const scriptNames = Object.keys(SCRIPT_EVENT_MAP) as ScriptName[];
  for (const scriptName of scriptNames) {
    const filePath = join(CLINE_HOOKS_DIR, scriptName);
    await writeFile(filePath, makeScript(port, SCRIPT_EVENT_MAP[scriptName]), { mode: 0o755 });
  }

  p.log.success("Cline hooks configured.");
  p.log.info(`Path: ${pc.dim(CLINE_HOOKS_DIR)}`);
  p.log.info(`Port: ${pc.dim(String(port))}`);
}

export async function isClineConfigured(): Promise<boolean> {
  const scriptNames = Object.keys(SCRIPT_EVENT_MAP) as ScriptName[];

  for (const scriptName of scriptNames) {
    const filePath = join(CLINE_HOOKS_DIR, scriptName);
    try {
      await stat(filePath);
    } catch {
      return false;
    }

    if (!(await hasMarker(filePath))) {
      return false;
    }
  }

  return true;
}

export async function removeCline(): Promise<void> {
  const scriptNames = Object.keys(SCRIPT_EVENT_MAP) as ScriptName[];
  let removed = 0;

  for (const scriptName of scriptNames) {
    const filePath = join(CLINE_HOOKS_DIR, scriptName);
    if (!(await hasMarker(filePath))) {
      continue;
    }

    await unlink(filePath);
    removed += 1;
  }

  if (removed === 0) {
    p.log.info("No distracted-managed Cline hooks found, nothing to remove.");
    return;
  }

  p.log.success("Cline hooks removed.");
  p.log.info(`Path: ${pc.dim(CLINE_HOOKS_DIR)}`);
}
