# Configuration

Use this guide when auto-config does not complete successfully, or when you want to wire Context Sync into an MCP client manually.

## General Notes

- Restart the client after changing MCP config.
- Global install is the default path for auto-config.
- Local installs do not auto-configure clients.
- You can either point directly at the installed server entrypoint or use `npx`.

## Recommended Server Entries

Direct node entry:

```json
{
  "context-sync": {
    "command": "node",
    "args": ["/path/to/@context-sync/server/dist/index.js"],
    "type": "stdio"
  }
}
```

`npx` entry:

```json
{
  "context-sync": {
    "command": "npx",
    "args": ["-y", "@context-sync/server"],
    "type": "stdio"
  }
}
```

## Client Locations

### Claude Desktop

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Use the `mcpServers` object.

### Cursor

- macOS/Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\\.cursor\\mcp.json`

Use the `mcpServers` object.

### VS Code With GitHub Copilot

- macOS: `~/Library/Application Support/Code/User/mcp.json`
- Windows: `%APPDATA%\\Code\\User\\mcp.json`
- Linux: `~/.config/Code/User/mcp.json`

Use the `servers` object and any required `inputs` entries expected by the client.

### Continue.dev

- Workspace config: `./.continue/mcpServers/context-sync.yaml`
- Global config: `~/.continue/config.yaml`

### Zed

- macOS: `~/Library/Application Support/Zed/settings.json`
- Windows: `%APPDATA%\\Zed\\settings.json`
- Linux: `~/.config/zed/settings.json`

Use the `context_servers` object.

### Windsurf

- macOS: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json`
- Linux: `~/.codeium/windsurf/mcp_config.json`

Use the `mcpServers` object.

### Codeium

- macOS: `~/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%\\Code\\User\\settings.json`
- Linux: `~/.config/Code/User/settings.json`

Use `codeium.mcp.servers`.

### TabNine

- macOS: `~/Library/Application Support/TabNine/config.json`
- Windows: `%APPDATA%\\TabNine\\config.json`
- Linux: `~/.config/TabNine/config.json`

Use `mcp.servers`.

### Codex CLI

Config file:

```text
~/.codex/config.toml
```

Example:

```toml
[mcp_servers.context-sync]
command = "npx"
args = ["-y", "@context-sync/server"]
```

### Claude Code

Config file:

```text
~/.claude/mcp_servers.json
```

CLI alternative:

```bash
claude mcp add context-sync "npx" -y @context-sync/server
```

### Antigravity

Config file:

```text
~/.gemini/antigravity/mcp_config.json
```

Use the `mcpServers` object.

## Runtime Data

Default paths:
- config: `~/.context-sync/config.json`
- database: `~/.context-sync/data.db`
- install status: `~/.context-sync/install-status.json`

Custom database options:
- CLI: `context-sync --db-path /absolute/path/to/db`
- env var: `CONTEXT_SYNC_DB_PATH`

## Notion Setup

Run:

```bash
context-sync-setup
```

This writes the Notion config used by the server at startup.

The current public Notion MCP tool surface is read-only:
- `search`
- `read`
