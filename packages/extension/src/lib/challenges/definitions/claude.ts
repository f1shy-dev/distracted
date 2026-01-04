import type { ChallengeDefinition } from "@/lib/challenges/options";

export const claudeDefinition = {
  label: "Claude Blocker",
  description: "Unlock only while Claude Code is actively working",
  title: "Claude Blocker",
  instructions: {
    title: "Claude Blocker setup",
    summary: "This unlock method only succeeds while Claude Code is actively running inference.",
    steps: [
      "Install and start the local Claude Blocker server (this also installs Claude Code hooks).",
      "Keep the server running while you work in Claude Code.",
      "If you change the server port, update the Server URL below.",
    ],
    commands: ["bunx @distracted/server --setup"],
    note: "If the server is offline or Claude is idle, the site stays locked.",
  },
  options: {
    serverUrl: {
      type: "text",
      label: "Claude Blocker Server URL",
      default: "http://localhost:8765",
    },
    allowWhileWaitingForInput: {
      type: "checkbox",
      label: "Allow while waiting for input",
      default: false,
      description: "Keep access open when Claude is waiting for your reply",
    },
  },
} as const satisfies ChallengeDefinition;
