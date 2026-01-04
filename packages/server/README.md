![distracted! - "block distracting websites! do mini tasks to get back on them..."](../extension/public/readme-banner.png)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ggimjhcfchbfdhpehdekdiblbfmijngf?label=chrome%20web%20store&style=for-the-badge)](https://chromewebstore.google.com/detail/distracted/ggimjhcfchbfdhpehdekdiblbfmijngf)
[![Firefox Add-ons](https://img.shields.io/amo/v/distracted?label=firefox%20add-ons&style=for-the-badge)](https://addons.mozilla.org/en-GB/firefox/addon/distracted/)
[![GitHub stars](https://img.shields.io/github/stars/f1shy-dev/distracted?style=for-the-badge&color=yellow)](https://github.com/f1shy-dev/distracted)

## what is this package?

local server that integrates with AI coding agent hooks (Claude Code + OpenCode) to enable real-time distraction blocking. receives hook events from your agent(s) and forwards them to the extension via websocket.

## how to use

### setup

install the extension first! then run the server:

```bash
bunx @distracted/server
```

if no agent hooks are configured yet, the CLI will prompt you to set them up.

you can also configure/remove hooks explicitly:

```bash
bunx @distracted/server --setup
bunx @distracted/server --setup claude
bunx @distracted/server --setup opencode
bunx @distracted/server --setup all

bunx @distracted/server --remove
bunx @distracted/server --remove claude
bunx @distracted/server --remove opencode
bunx @distracted/server --remove all

bunx @distracted/server --status
```

by default the server runs on port 8765 (or use `--port <port>` to specify a different port).

configuration locations:

- Claude Code: `~/.claude/settings.json` (hooks that `curl` to the local server)
- OpenCode: `~/.config/opencode/plugin/distracted.ts` (self-contained plugin file)

in the extension, setup a distraction with Claude Blocker as the unlock method.

## how it works

- Claude Code hooks and/or OpenCode plugin send hook events (UserPromptSubmit, PreToolUse, SessionStart/End, etc.) to the local server via HTTP POST
- the server processes these events and maintains state about agent activity across multiple sessions
- the extension connects via websocket and receives real-time updates
- if either agent is active/working, the user is unblocked

## credits

- @t3dotgg/[@theo](https://x.com/theo) for the original [claude-blocker](https://github.com/t3dotgg/claude-blocker)
- [opencode](https://github.com/anomalyco/opencode) for some small bits of CLI code ([`lib/ui.ts`](src/lib/ui.ts), [`lib/error.ts`](src/lib/error.ts))
