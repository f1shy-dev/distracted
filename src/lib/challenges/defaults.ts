import type { UnlockMethod, ChallengeSettingsMap } from "@/lib/challenges";

export const DEFAULT_CHALLENGE_SETTINGS: ChallengeSettingsMap = {
  timer: { duration: 10 },
  hold: { duration: 10 },
  type: {},
  claude: {
    serverUrl: "http://localhost:8765",
    allowWhileWaitingForInput: false,
  },
  strict: {},
} as const;

export function getDefaultChallengeSettings<M extends UnlockMethod>(
  method: M,
): ChallengeSettingsMap[M] {
  return DEFAULT_CHALLENGE_SETTINGS[method];
}

export function isUnlockMethod(value: string | undefined): value is UnlockMethod {
  return !!value && value in DEFAULT_CHALLENGE_SETTINGS;
}
