**Data and Local Storage**

**Default paths**
- Database: `~/.context-sync/data.db`
- Config: `~/.context-sync/config.json`
- Install status: `~/.context-sync/install-status.json`

**Custom database path**
- CLI arg: `context-sync --db-path /absolute/path/to/db`
- Env var: `CONTEXT_SYNC_DB_PATH=/absolute/path/to/db`

**What is stored**
- Projects and metadata
- Context layers: active work, constraints, problems, goals, decisions, notes, caveats
- Conversation summaries (for recall synthesis)

**Backups**
- First run may migrate legacy data and create a backup file next to the DB.

**Delete all data**
- Remove `~/.context-sync/` (this deletes DB and config).
