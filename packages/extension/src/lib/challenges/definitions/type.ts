import {
  selectOption,
  checkboxGroupOption,
  type ChallengeDefinition,
} from "@/lib/challenges/options";

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
    randomModeInclude: {
      ...checkboxGroupOption({
        label: "Include Character Sets",
        description: "Select which character types to include in random strings",
        default: ["uppercase", "lowercase", "numbers"],
        options: [
          { label: "Uppercase (A-Z)", value: "uppercase" },
          { label: "Lowercase (a-z)", value: "lowercase" },
          { label: "Numbers (0-9)", value: "numbers" },
          { label: "Special (!@#$...)", value: "special" },
        ] as const,
      }),
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
