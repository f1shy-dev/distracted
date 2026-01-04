import { selectOption, type ChallengeDefinition } from "@/lib/challenges/options";

export const typeDefinition = {
  label: "Type Text",
  description: "Type text to unlock (no copy/paste)",
  title: "Type to Access",
  options: {
    mode: selectOption({
      label: "Text Mode",
      description: "Choose the type of text to type",
      default: "uuid",
      options: [
        { label: "UUID", value: "uuid" },
        { label: "Random String", value: "random" },
        { label: "Custom Phrase", value: "custom" },
      ] as const,
    }),
    length: {
      type: "slider",
      label: "Length",
      description: "Number of characters to generate",
      default: 21,
      min: 5,
      max: 100,
      step: 1,
      when: (s) => s.mode === "random",
    },
    includeUppercase: {
      type: "checkbox",
      label: "Include Uppercase (A-Z)",
      default: true,
      when: (s) => s.mode === "random",
    },
    includeLowercase: {
      type: "checkbox",
      label: "Include Lowercase (a-z)",
      default: true,
      when: (s) => s.mode === "random",
    },
    includeNumbers: {
      type: "checkbox",
      label: "Include Numbers (0-9)",
      default: true,
      when: (s) => s.mode === "random",
    },
    includeSpecial: {
      type: "checkbox",
      label: "Include Special Characters (!@#$...)",
      default: false,
      when: (s) => s.mode === "random",
    },
    customText: {
      type: "text",
      label: "Custom Phrase",
      description: "Enter the exact text to type",
      default: "",
      multiline: true,
      placeholder: "Enter your custom phrase here...",
      when: (s) => s.mode === "custom",
    },
  },
} as const satisfies ChallengeDefinition;
