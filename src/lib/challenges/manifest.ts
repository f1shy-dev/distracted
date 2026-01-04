import { timerDefinition } from "@/lib/challenges/definitions/timer";
import { holdDefinition } from "@/lib/challenges/definitions/hold";
import { typeDefinition } from "@/lib/challenges/definitions/type";
import { claudeDefinition } from "@/lib/challenges/definitions/claude";
import { strictDefinition } from "@/lib/challenges/definitions/strict";
import type { InferOptionValues } from "@/lib/challenges/options";

const CHALLENGE_DEFINITIONS = {
  timer: timerDefinition,
  hold: holdDefinition,
  type: typeDefinition,
  claude: claudeDefinition,
  strict: strictDefinition,
} as const;

export type UnlockMethod = keyof typeof CHALLENGE_DEFINITIONS;

export type ChallengeSettingsMap = {
  [K in UnlockMethod]: InferOptionValues<(typeof CHALLENGE_DEFINITIONS)[K]["options"]>;
};

const unlockMethodSet = new Set<UnlockMethod>(Object.keys(CHALLENGE_DEFINITIONS) as UnlockMethod[]);

export function isUnlockMethod(value: unknown): value is UnlockMethod {
  return typeof value === "string" && unlockMethodSet.has(value as UnlockMethod);
}

export function getDefaultChallengeSettings<M extends UnlockMethod>(
  method: M,
): ChallengeSettingsMap[M] {
  const options = CHALLENGE_DEFINITIONS[method].options;
  const settings: Record<string, unknown> = {};
  for (const [key, opt] of Object.entries(options)) {
    settings[key] = (opt as { default: unknown }).default;
  }
  return settings as ChallengeSettingsMap[M];
}
