**Manual Configuration**
- Use this when auto-config fails or you prefer manual setup.
- Restart the app/CLI after editing config files.
- Server entry should point to the global install or use `npx -y @context-sync/server`.

**Server Entry (JSON)**
```json
{
  "context-sync": {
    "command": "node",
    "args": ["/path/to/@context-sync/server/dist/index.js"],
    "type": "stdio"
  }
}
```

**Server Entry (npx)**
```json
{
  "context-sync": {
    "command": "npx",
    "args": ["-y", "@context-sync/server"],
    "type": "stdio"
  }
}
```

**Claude Desktop**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Structure: `mcpServers` object.

**Cursor**
- macOS/Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json`
- Structure: `mcpServers` object.

**VS Code (GitHub Copilot)**
- macOS: `~/Library/Application Support/Code/User/mcp.json`
- Windows: `%APPDATA%\Code\User\mcp.json`
- Linux: `~/.config/Code/User/mcp.json`
- Structure: `servers` object + `inputs` array.

**Continue.dev**
- Workspace: `./.continue/mcpServers/context-sync.yaml`
- Global: `~/.continue/config.yaml`
- Structure: server definition in YAML.

**Zed**
- macOS: `~/Library/Application Support/Zed/settings.json`
- Windows: `%APPDATA%\Zed\settings.json`
- Linux: `~/.config/zed/settings.json`
- Structure: `context_servers` object.

**Windsurf**
- macOS: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
- Linux: `~/.codeium/windsurf/mcp_config.json`
- Structure: `mcpServers` object.

**Codeium**
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%\Code\User\settings.json`
- Linux: `~/.config/Code/User/settings.json`
- Structure: `codeium.mcp` with `servers`.

**TabNine**
- macOS: `~/Library/Application Support/TabNine/config.json`
- Windows: `%APPDATA%\TabNine\config.json`
- Linux: `~/.config/TabNine/config.json`
- Structure: `mcp.servers`.

**Codex CLI**
- Config: `~/.codex/config.toml`
- Add:
```toml
[mcp_servers.context-sync]
command = "npx"
args = ["-y", "@context-sync/server"]
```

**Claude Code (Anthropic CLI)**
- Config: `~/.claude/mcp_servers.json`
- Structure: `mcpServers` object.
- CLI option: `claude mcp add context-sync "npx" -y @context-sync/server`

**Antigravity (Google Gemini IDE)**
- Config: `~/.gemini/antigravity/mcp_config.json`
- Structure: `mcpServers` object.

