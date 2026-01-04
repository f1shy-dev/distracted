## @distracted/opencode

OpenCode plugin for distracted's AI coding agent integration.

### usage (OpenCode)

Install and load via OpenCode's plugin mechanism.

This plugin forwards session + tool events to a local distracted server:

- default URL: `http://localhost:8765/hook`
- override port via `DISTRACTED_PORT` environment variable

### events

The plugin emits the same hook payload format as Claude Code hooks so `@distracted/server` can treat both agents uniformly.
