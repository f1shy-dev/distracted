import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { UI } from "@/lib/ui";

const EXTENSIONS_DIR = join(homedir(), ".omp", "agent", "extensions");
const EXTENSION_FILE = join(EXTENSIONS_DIR, "distracted.mjs");
const EXTENSION_CONTENT = `// @distracted/server hook — auto-generated
export { default } from "@distracted/pi";
`;

export async function setupPi(port: number): Promise<void> {
  await mkdir(EXTENSIONS_DIR, { recursive: true });
  await writeFile(EXTENSION_FILE, EXTENSION_CONTENT);

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Pi extension configured." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Path: ${EXTENSION_FILE}` + UI.Style.TEXT_NORMAL);
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
    const content = await readFile(EXTENSION_FILE, "utf-8");
    return content.includes("@distracted/pi");
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

  try {
    await unlink(EXTENSION_FILE);
  } catch {}

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Pi extension removed." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Path: ${EXTENSION_FILE}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}
