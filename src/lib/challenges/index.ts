import { timerChallenge } from "@/components/challenges/timer";
import { holdChallenge } from "@/components/challenges/hold";
import { typeChallenge } from "@/components/challenges/type";
import { claudeBlockerChallenge } from "@/components/challenges/claude-blocker";
import { strictChallenge } from "@/components/challenges/strict";
import type { InferOptionValues } from "./types";

export const CHALLENGES = {
  timer: timerChallenge,
  hold: holdChallenge,
  type: typeChallenge,
  claude: claudeBlockerChallenge,
  strict: strictChallenge,
} as const;

export type UnlockMethod = keyof typeof CHALLENGES;

export type ChallengeSettingsMap = {
  [K in UnlockMethod]: InferOptionValues<(typeof CHALLENGES)[K]["options"]>;
};

export function getDefaultChallengeSettings<M extends UnlockMethod>(
  method: M,
): ChallengeSettingsMap[M] {
  const challenge = CHALLENGES[method];
  const settings: Record<string, unknown> = {};
  for (const [key, opt] of Object.entries(challenge.options)) {
    settings[key] = (opt as { default: unknown }).default;
  }
  return settings as ChallengeSettingsMap[M];
}
