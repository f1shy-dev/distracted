import type { UnlockMethod } from "@/lib/challenges/manifest";
import { timerChallenge } from "@/components/challenges/timer";
import { holdChallenge } from "@/components/challenges/hold";
import { typeChallenge } from "@/components/challenges/type";
import { claudeBlockerChallenge } from "@/components/challenges/claude-blocker";
import { strictChallenge } from "@/components/challenges/strict";

export const CHALLENGE_UI = {
  timer: timerChallenge,
  hold: holdChallenge,
  type: typeChallenge,
  claude: claudeBlockerChallenge,
  strict: strictChallenge,
} as const satisfies Record<UnlockMethod, unknown>;
