**Troubleshooting**

**Auto-config did not run**
- Auto-config runs only on global install.
- Fix: `npm install -g @context-sync/server`
- Check status file: `~/.context-sync/install-status.json`
  - If `needsManual` is true, use `docs/CONFIG.md`.

**Tools do not show in your AI app**
- Restart the app/CLI after install.
- Verify the MCP config file exists (see `docs/CONFIG.md`).
- Check for a `context-sync` entry in the config.

**Codex CLI**
- Verify: `codex mcp list`
- Config: `~/.codex/config.toml`

**Claude Code**
- Verify: `claude mcp list`
- Config: `~/.claude/mcp_servers.json`

**Notion says "not configured"**
- Run: `context-sync-setup` (or `npx context-sync-setup`)
- Ensure the integration token is valid (`secret_` or `ntn_` prefix).

**Notion returns no pages**
- Share a Notion page with the integration.
- Retry the wizard or run Notion search again.

**Auto-config created a file but app still cannot see tools**
- Ensure config file is valid JSON/TOML/YAML.
- Restart the app completely.

**Git hooks not installed**
- Hooks are installed during `set_project` if the repo has `.git`.
- Re-run `set_project`.
- Check `.git/hooks` for files containing "Context Sync Auto-Hook".

**Migration messages on startup**
- First run may migrate legacy data and create a backup.
- If the migration fails, your data is not modified; see console output for backup path.
