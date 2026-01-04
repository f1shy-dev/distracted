import type { ChallengeDefinition } from "@/lib/challenges/options";

export const strictDefinition = {
  label: "Strict Mode",
  description: "No unlock method available",
  title: "Strict Mode",
  options: {},
} as const satisfies ChallengeDefinition;
