import {
  checkboxGroupOption,
  selectOption,
  type ChallengeDefinition,
} from "@/lib/challenges/options";

export const mathsDefinition = {
  label: "Math Challenge",
  description: "Solve math problems to unlock",
  title: "Math Challenge",
  options: {
    questionCount: {
      type: "slider",
      label: "Number of Questions",
      description: "How many math problems to solve",
      default: 3,
      min: 1,
      max: 10,
      step: 1,
    },
    operations: {
      ...checkboxGroupOption({
        label: "Operations",
        description: "Select which math operations to include",
        default: [
          "addition",
          "subtraction",
          "multiplication",
          "division",
          "exponentiation",
          "squareRoot",
          "modulo",
        ],
        options: [
          { label: "Add (+)", value: "addition" },
          { label: "Sub (-)", value: "subtraction" },
          { label: "Multiply (×)", value: "multiplication" },
          { label: "Divide (÷)", value: "division" },
          { label: "Exp (^)", value: "exponentiation" },
          { label: "Sqrt (√)", value: "squareRoot" },
          { label: "Modulo (%)", value: "modulo" },
        ] as const,
      }),
    },
    instantSubmit: {
      type: "checkbox",
      label: "Instant Submit",
      description: "Automatically advance when the correct answer is entered",
      default: true,
    },
    difficulty: selectOption({
      label: "Difficulty",
      description: "How aggressive the generator should be about avoiding easy problems",
      default: "medium",
      options: [
        { label: "Easy", value: "easy" },
        { label: "Medium", value: "medium" },
        { label: "Hard", value: "hard" },
        { label: "Annoying", value: "annoying" },
      ] as const,
    }),
  },
} as const satisfies ChallengeDefinition;
