import type { ChallengeDefinition } from "@/lib/challenges/options";

export const holdDefinition = {
  label: "Hold Button",
  description: "Hold a button continuously",
  title: "Hold to Access",
  options: {
    duration: {
      type: "number",
      label: "Hold duration (seconds)",
      default: 10,
      min: 1,
    },
  },
} as const satisfies ChallengeDefinition;
