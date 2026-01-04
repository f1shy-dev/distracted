import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

import { UI } from "@/lib/ui";

const CONFIG_DIR = join(homedir(), ".config", "distracted");
const CONFIG_PATH = join(CONFIG_DIR, "capy.json");
const CAPY_BASE_URL = "https://capy.ai";

interface CapyConfig {
  apiToken?: string;
  baseUrl?: string;
}

async function readConfig(): Promise<CapyConfig> {
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(content) as CapyConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: CapyConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

function openBrowser(url: string): void {
  const platform = process.platform;

  const child =
    platform === "darwin"
      ? spawn("open", [url], { stdio: "ignore", detached: true })
      : platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
        : spawn("xdg-open", [url], { stdio: "ignore", detached: true });

  child.unref();
}

async function pollForToken(
  sessionToken: string,
  codeVerifier: string,
  baseUrl: string,
): Promise<string | null> {
  const maxAttempts = 60;
  const pollInterval = 5000;

  UI.println(UI.Style.TEXT_INFO + "Waiting for authentication..." + UI.Style.TEXT_NORMAL);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/cli-token-redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken, code_verifier: codeVerifier }),
      });

      if (response.ok) {
        const data = (await response.json()) as { status?: string; apiToken?: string };
        if (data.status === "success" && typeof data.apiToken === "string") {
          UI.empty();
          return data.apiToken;
        }
        if (data.status === "pending") {
          UI.print(".");
          await new Promise((r) => setTimeout(r, pollInterval));
          continue;
        }
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    } catch {
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  UI.empty();
  return null;
}

export async function setupCapy(): Promise<void> {
  const existing = await readConfig();

  if (typeof existing.apiToken === "string" && existing.apiToken.length > 0) {
    const answer = await UI.input(
      `Capy is already configured. Re-authenticate? (y/n)\n> `,
    );
    if (answer.toLowerCase() !== "y") {
      UI.println(UI.Style.TEXT_DIM + "Keeping existing Capy configuration." + UI.Style.TEXT_NORMAL);
      UI.empty();
      return;
    }
  }

  const baseUrl = typeof existing.baseUrl === "string" ? existing.baseUrl : CAPY_BASE_URL;
  const sessionToken = crypto.randomBytes(64).toString("hex");
  const deviceName = hostname() || "distracted";
  const { codeVerifier, codeChallenge } = generatePKCE();

  const authUrl = `${baseUrl.replace(/\/$/, "")}/cli-auth?token=${encodeURIComponent(sessionToken)}&device_name=${encodeURIComponent(deviceName)}&code_challenge=${encodeURIComponent(codeChallenge)}&challenge_method=S256`;

  UI.println(UI.Style.TEXT_INFO_BOLD + "Capy Authentication" + UI.Style.TEXT_NORMAL);
  UI.println("Opening browser for authentication...");
  UI.println(UI.Style.TEXT_DIM + authUrl + UI.Style.TEXT_NORMAL);

  try {
    openBrowser(authUrl);
  } catch {
    UI.println(UI.Style.TEXT_DIM + "Could not open browser automatically." + UI.Style.TEXT_NORMAL);
  }

  const apiToken = await pollForToken(sessionToken, codeVerifier, baseUrl);

  if (!apiToken) {
    UI.error("Authentication failed or timed out");
    UI.empty();
    return;
  }

  await writeConfig({ ...existing, apiToken, baseUrl });

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Capy configured." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Config: ${CONFIG_PATH}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}

export async function isCapyConfigured(): Promise<boolean> {
  const config = await readConfig();
  return typeof config.apiToken === "string" && config.apiToken.length > 0;
}

export async function getCapyConfig(): Promise<CapyConfig | null> {
  const config = await readConfig();
  if (typeof config.apiToken !== "string" || config.apiToken.length === 0) return null;
  return config;
}

export async function removeCapy(): Promise<void> {
  const config = await readConfig();

  if (typeof config.apiToken !== "string" || config.apiToken.length === 0) {
    UI.println(UI.Style.TEXT_DIM + "No Capy config found, nothing to remove." + UI.Style.TEXT_NORMAL);
    UI.empty();
    return;
  }

  delete config.apiToken;
  await writeConfig(config);

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Capy configuration removed." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Config: ${CONFIG_PATH}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}
