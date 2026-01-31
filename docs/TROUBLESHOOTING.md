# Troubleshooting

This guide targets common developer issues when running Context Sync under MCP.

## Quick diagnostics
1. Confirm the server entry exists and is valid JSON/TOML/YAML.
2. Restart the AI client (most clients only load MCP servers on startup).
3. Verify the server can run from a terminal: `npx -y @context-sync/server`.
4. Check the install status: `~/.context-sync/install-status.json`.

## Installation & auto-config
**Auto-config did not run**
- Auto-config runs only on global installs.
- Fix: `npm install -g @context-sync/server`
- If `~/.context-sync/install-status.json` shows `needsManual: true`, follow `docs/CONFIG.md`.

**Tools do not show up in your AI client**
- Restart the app/CLI after install.
- Verify the MCP config file exists and contains `context-sync`.
- Ensure `command` is on PATH for the user running the AI client.

## Client-specific checks
**Codex CLI**
- Verify: `codex mcp list`
- Config: `~/.codex/config.toml`

**Claude Code**
- Verify: `claude mcp list`
- Config: `~/.claude/mcp_servers.json`

## Core tool errors
**"No workspace set"**
- Cause: Calling tools before `set_project`.
- Fix: `set_project({ path: "/absolute/path" })`

**"Not a git repository"**
- Cause: The current workspace isn’t a Git repo.
- Fix: Run `set_project` inside a Git repo or skip git actions.

**"No such table" or DB errors**
- Cause: Corrupt or old database.
- Fix: Move `~/.context-sync/data.db` aside and re-run the server to rebuild.

## Notion errors
**"Notion is not configured"**
- Run: `context-sync-setup` (or `npx context-sync-setup`).
- Confirm the token starts with `secret_` or `ntn_`.

**"Failed to read page"**
- Ensure the page ID is a valid UUID.
- Share the page with your Notion integration.

**Search returns no pages**
- Verify the integration has access to the workspace/page.
- Try a broader search query.

## Git hooks
**Hooks not installed**
- Hooks are installed during `set_project` if the repo has `.git`.
- Re-run `set_project` in the repo root.
- Check `.git/hooks` for files containing "Context Sync Auto-Hook".

**Hooks installed but no events captured**
- Ensure the DB path is valid and writable.
- Confirm hooks are executable (`chmod +x .git/hooks/post-commit`).

## Migration messages on startup
- First run may migrate legacy data and create a backup.
- If migration fails, your data is not modified; check console output for the backup path.

## Still stuck?
- Run the server directly to see stderr logs:
```bash
npx -y @context-sync/server
```
- Include the exact error output when reporting issues.
