import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { UI } from "@/lib/ui";

const EXTENSION_NAME = "@distracted/pi-extension";

const PiSettingsSchema = z
  .object({
    extensions: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());

function getSettingsPath(): string {
  return join(homedir(), ".pi", "agent", "settings.json");
}

async function readPiSettings(): Promise<z.infer<typeof PiSettingsSchema> | null> {
  try {
    const content = await readFile(getSettingsPath(), "utf-8");
    const raw = JSON.parse(content) as unknown;
    const parsed = PiSettingsSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data as z.infer<typeof PiSettingsSchema>;
  } catch {
    return null;
  }
}

async function writePiSettings(settings: z.infer<typeof PiSettingsSchema>): Promise<void> {
  const settingsPath = getSettingsPath();
  const dir = join(homedir(), ".pi", "agent");
  await mkdir(dir, { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

export async function setupPi(port: number): Promise<void> {
  const settingsPath = getSettingsPath();
  const settings = (await readPiSettings()) ?? {};

  if (!settings.extensions) {
    settings.extensions = [];
  }

  if (!settings.extensions.includes(EXTENSION_NAME)) {
    settings.extensions.push(EXTENSION_NAME);
  }

  await writePiSettings(settings);

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Pi extension configured." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Config: ${settingsPath}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Extension: ${EXTENSION_NAME}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Port: ${port}` + UI.Style.TEXT_NORMAL);
  UI.println(
    UI.Style.TEXT_DIM +
      "Note: Set DISTRACTED_PORT environment variable if using a different port" +
      UI.Style.TEXT_NORMAL,
  );
  UI.empty();
}

export async function isPiConfigured(): Promise<boolean> {
  try {
    const settings = await readPiSettings();
    return Array.isArray(settings?.extensions) && settings.extensions.includes(EXTENSION_NAME);
  } catch {
    return false;
  }
}

export async function removePi(): Promise<void> {
  const configured = await isPiConfigured();
  if (!configured) {
    UI.println(
      UI.Style.TEXT_DIM + "No Pi extension found, nothing to remove." + UI.Style.TEXT_NORMAL,
    );
    return;
  }

  const settings = await readPiSettings();
  if (settings && Array.isArray(settings.extensions)) {
    settings.extensions = settings.extensions.filter((e) => e !== EXTENSION_NAME);
    if (settings.extensions.length === 0) {
      delete settings.extensions;
    }
    await writePiSettings(settings);
  }

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Pi extension removed." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Config: ${getSettingsPath()}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}
