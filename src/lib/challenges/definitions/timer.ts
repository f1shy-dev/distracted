import type { ChallengeDefinition } from "@/lib/challenges/options";

export const timerDefinition = {
  label: "Wait Timer",
  description: "Wait for a countdown to finish",
  title: "Wait to Access",
  options: {
    duration: {
      type: "number",
      label: "Timer duration (seconds)",
      default: 10,
      min: 1,
    },
  },
} as const satisfies ChallengeDefinition;
