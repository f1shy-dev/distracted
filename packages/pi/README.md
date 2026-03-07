# @distracted/pi

[Pi (oh-my-pi)](https://github.com/can1357/oh-my-pi) extension for [distracted](https://github.com/f1shy-dev/distracted).

## Installation

### Via distracted CLI (recommended)

```bash
bunx @distracted/server --setup pi
```

### Manual setup

1. Install: `npm install -g @distracted/pi`
2. Add to Pi config (`~/.omp/agent/config.yml`):

```yaml
extensions:
  - @distracted/pi
```

Or use the CLI flag: `pi --extension @distracted/pi`

## Configuration

Set `DISTRACTED_PORT` environment variable if using a non-default port (default: 8765).
