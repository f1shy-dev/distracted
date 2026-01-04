import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { UI } from "@/lib/ui";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_PATH = join(CONFIG_DIR, "opencode.json");
const PLUGIN_NAME = "@distracted/opencode";

type OpenCodeConfig = {
  $schema?: string;
  plugin?: string[];
  [key: string]: unknown;
};

async function readConfig(): Promise<OpenCodeConfig> {
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(content) as OpenCodeConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: OpenCodeConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export async function setupOpenCode(port: number): Promise<void> {
  const config = await readConfig();

  if (!config.plugin) {
    config.plugin = [];
  }

  if (!Array.isArray(config.plugin)) {
    config.plugin = [config.plugin as string];
  }

  if (!config.plugin.includes(PLUGIN_NAME)) {
    config.plugin.push(PLUGIN_NAME);
  }

  if (!config.$schema) {
    config.$schema = "https://opencode.ai/config.json";
  }

  await writeConfig(config);

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "OpenCode plugin configured." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Config: ${CONFIG_PATH}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Plugin: ${PLUGIN_NAME}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Port: ${port}` + UI.Style.TEXT_NORMAL);
  UI.println(
    UI.Style.TEXT_DIM +
      "Note: Set DISTRACTED_PORT environment variable if using a different port" +
      UI.Style.TEXT_NORMAL,
  );
  UI.empty();
}

export async function isOpenCodeConfigured(): Promise<boolean> {
  try {
    const config = await readConfig();
    return Array.isArray(config.plugin) && config.plugin.includes(PLUGIN_NAME);
  } catch {
    return false;
  }
}

export async function removeOpenCode(): Promise<void> {
  const configured = await isOpenCodeConfigured();
  if (!configured) {
    UI.println(
      UI.Style.TEXT_DIM + "No OpenCode plugin found, nothing to remove." + UI.Style.TEXT_NORMAL,
    );
    return;
  }

  const config = await readConfig();
  if (Array.isArray(config.plugin)) {
    config.plugin = config.plugin.filter((p) => p !== PLUGIN_NAME);
    if (config.plugin.length === 0) {
      delete config.plugin;
    }
  }

  await writeConfig(config);
  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "OpenCode plugin removed." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Config: ${CONFIG_PATH}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}
