# Manual Configuration Guide

This guide covers **manual MCP server configuration** for Context Sync. Use it when auto-config doesn't run or when you need a fully explicit setup.

## When to use manual config
- You installed locally (auto-config only runs for global installs).
- Your AI client isn't supported by auto-config yet.
- You prefer to maintain MCP configuration in source control (e.g., team onboarding docs).

## Quick reference (server entries)
You can run the server via a global install or via `npx`. Both work; choose the one that fits your environment.

### Option A: `npx` (recommended for most users)
```json
{
  "context-sync": {
    "command": "npx",
    "args": ["-y", "@context-sync/server"],
    "type": "stdio"
  }
}
```

### Option B: global install (explicit Node path)
```json
{
  "context-sync": {
    "command": "node",
    "args": ["/path/to/@context-sync/server/dist/index.js"],
    "type": "stdio"
  }
}
```

**Notes:**
- `command` must be on PATH.
- `args` must include an absolute path when using the `node` option.
- The MCP transport is **stdio**.

## Common fields
| Field | Description |
| --- | --- |
| `command` | Executable to run (usually `npx` or `node`). |
| `args` | CLI arguments for Context Sync. |
| `type` | MCP transport type. Always `"stdio"`. |

## Platform-specific configs
Below are known configuration locations. Each example shows only the **MCP section** you need to add.

### Claude Desktop
**Path**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Shape**
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  }
}
```

### Cursor
**Path**
- macOS/Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json`

**Shape**
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  }
}
```

### VS Code (GitHub Copilot)
**Path**
- macOS: `~/Library/Application Support/Code/User/mcp.json`
- Windows: `%APPDATA%\Code\User\mcp.json`
- Linux: `~/.config/Code/User/mcp.json`

**Shape**
```json
{
  "servers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  },
  "inputs": []
}
```

### Continue.dev
**Path**
- Workspace: `./.continue/mcpServers/context-sync.yaml`
- Global: `~/.continue/config.yaml`

**Shape**
```yaml
mcpServers:
  context-sync:
    command: npx
    args:
      - -y
      - @context-sync/server
    type: stdio
```

### Zed
**Path**
- macOS: `~/Library/Application Support/Zed/settings.json`
- Windows: `%APPDATA%\Zed\settings.json`
- Linux: `~/.config/zed/settings.json`

**Shape**
```json
{
  "context_servers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  }
}
```

### Windsurf
**Path**
- macOS: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
- Linux: `~/.codeium/windsurf/mcp_config.json`

**Shape**
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  }
}
```

### Codeium
**Path**
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%\Code\User\settings.json`
- Linux: `~/.config/Code/User/settings.json`

**Shape**
```json
{
  "codeium.mcp": {
    "servers": {
      "context-sync": {
        "command": "npx",
        "args": ["-y", "@context-sync/server"],
        "type": "stdio"
      }
    }
  }
}
```

### TabNine
**Path**
- macOS: `~/Library/Application Support/TabNine/config.json`
- Windows: `%APPDATA%\TabNine\config.json`
- Linux: `~/.config/TabNine/config.json`

**Shape**
```json
{
  "mcp": {
    "servers": {
      "context-sync": {
        "command": "npx",
        "args": ["-y", "@context-sync/server"],
        "type": "stdio"
      }
    }
  }
}
```

### Codex CLI
**Path**
- `~/.codex/config.toml`

**Shape**
```toml
[mcp_servers.context-sync]
command = "npx"
args = ["-y", "@context-sync/server"]
```

### Claude Code (Anthropic CLI)
**Path**
- `~/.claude/mcp_servers.json`

**Shape**
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  }
}
```

CLI shortcut:
```bash
claude mcp add context-sync "npx" -y @context-sync/server
```

### Antigravity (Google Gemini IDE)
**Path**
- `~/.gemini/antigravity/mcp_config.json`

**Shape**
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"],
      "type": "stdio"
    }
  }
}
```

## Validation checklist
- JSON/TOML/YAML syntax is valid.
- The config file is saved to the correct location.
- You restarted the AI client after editing config.
- `npx` or `node` is available in PATH for the user running the AI client.

If things still fail, see `docs/TROUBLESHOOTING.md`.
