# Data & Storage

Context Sync is **local-first**. All state is stored in a local SQLite database and a small JSON config file.

## Default paths
- Database: `~/.context-sync/data.db`
- Config: `~/.context-sync/config.json`
- Install status: `~/.context-sync/install-status.json`

## Custom database path
Use a custom DB location if you need per-project isolation or if home directories are ephemeral.

**CLI flag**
```bash
context-sync --db-path /absolute/path/to/db
```

**Environment variable**
```bash
CONTEXT_SYNC_DB_PATH=/absolute/path/to/db
```

## What is stored
Context Sync stores structured project context, including:
- Project identity (name, path, detected tech stack, purpose).
- Context layers: active work, constraints, problems, goals, decisions, notes, caveats.
- Conversation summaries for recall synthesis.
- Git hook events (commit, push, merge, checkout) as decisions or active work.

## Notion configuration
`~/.context-sync/config.json` stores optional Notion settings:
```json
{
  "notion": {
    "token": "secret_or_ntn_token",
    "defaultParentPageId": "optional-page-id"
  }
}
```

Only the token is required for search/read.

## Backups and migrations
On first run, Context Sync may migrate legacy data and create a backup file next to the DB.
- Migrations are **safe** and **atomic**.
- If migration fails, the original data is not modified.

## Data deletion
To remove all Context Sync data:
```bash
rm -rf ~/.context-sync/
```

## Security notes
- Data is stored locally and never sent to third parties by default.
- Protect `~/.context-sync/config.json` because it can contain Notion tokens.
