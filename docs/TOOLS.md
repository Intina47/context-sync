# Context Sync Tools (MCP)

Context Sync exposes **9 core tools** over MCP. These tools are intentionally minimal and designed for daily developer workflows.

## Required tool flow
1. `set_project` (must be first)
2. `recall` (restore context)
3. `structure` / `search` / `read_file` (explore code)
4. `remember` (store decisions, constraints, problems, etc.)

If you see **"No workspace set"**, call `set_project` again.

## Tool catalog
| Tool | Purpose | Required args |
| --- | --- | --- |
| `set_project` | Initialize a project and capture tech stack/metadata. | `path` |
| `remember` | Store context (active work, constraints, problems, goals, decisions, notes, caveats). | `type`, `content` |
| `recall` | Retrieve project context (active work, constraints, decisions, etc.). | _none_ |
| `read_file` | Read a file from the current workspace. | `path` |
| `search` | Search by file name or file contents. | `query`, `type` |
| `structure` | Summarize project structure. | _none_ |
| `git` | Git status, context, hotspots, coupling, blame, analysis. | `action` |
| `notion` | Read-only Notion access. | `action` |

## `set_project`
Initialize the workspace. This detects the tech stack and prepares internal caches.

```json
set_project({
  "path": "/absolute/path/to/project",
  "purpose": "Optional: what this project does"
})
```

**Tips**
- Always use absolute paths.
- Calling `set_project` on a new path switches the current project.

## `remember`
Store important, durable context. Use it for anything that should survive sessions.

```json
remember({
  "type": "decision",
  "content": "Use SQLite for local storage",
  "metadata": { "files": ["src/storage.ts"] }
})
```

**Types**
- `active_work` – current task and status
- `constraint` – architectural rules or policies
- `problem` – blockers or bugs
- `goal` – outcomes and milestones
- `decision` – key decisions with rationale
- `note` – general info
- `caveat` – AI mistakes, shortcuts, or unverified work

### Caveats (important)
When using `type: "caveat"`, include metadata:
```json
{
  "category": "unverified",
  "severity": "medium",
  "attempted": "Updated git actions",
  "error": "Schema validation failed",
  "recovery": "Created manual test script",
  "verified": true,
  "action_required": "Restart MCP server",
  "affects_production": true
}
```

## `recall`
Retrieve context for the current project.
```json
recall({ "query": "what were we working on?" })
```

Optional parameters:
- `query` – focus the response.
- `limit` – how many recent items per category (default 10).

## `read_file`
Read a file relative to the workspace root.
```json
read_file({ "path": "src/index.ts" })
```

## `search`
Search by file name or contents.
```json
search({ "query": "ContextSyncServer", "type": "content" })
```

Optional search options:
```json
{
  "regex": true,
  "caseSensitive": false,
  "filePattern": "src/**/*.ts",
  "maxResults": 50
}
```

## `structure`
Return a simplified file tree (default depth 3).
```json
structure({ "depth": 2 })
```

## `git`
One tool, multiple actions:
```json
git({ "action": "status" })
```

### Available actions
- `status` – working tree summary and change impact.
- `context` – commit context + suggested commit messages.
- `hotspots` – files with high change frequency.
- `coupling` – files that change together.
- `blame` – code ownership for a path.
- `analysis` – consolidated health overview.

### Examples
```json
git({ "action": "blame", "path": "src/server.ts" })
```
```json
git({ "action": "hotspots", "limit": 5 })
```

## `notion`
Read-only access to your Notion workspace. Requires the setup wizard.
```json
notion({ "action": "search", "query": "architecture" })
notion({ "action": "read", "pageId": "<uuid>" })
```

If Notion is not configured, the tool returns an error with setup instructions.

## Prompts & resources (MCP extras)
Context Sync also exposes MCP prompts/resources (useful for building agents):
- `context-sync-usage` prompt
- `debugging-context-sync` prompt
- `context-sync://docs/usage-guide`
- `context-sync://docs/debugging-guide`
- `context-sync://docs/tool-flow`

## Common errors
| Error | Likely cause | Fix |
| --- | --- | --- |
| `No workspace set` | `set_project` wasn’t called | Run `set_project` with an absolute path. |
| `Not a git repository` | Path isn't in a Git repo | Run `set_project` inside a repo or skip git tools. |
| `Notion is not configured` | Setup not run | Run `context-sync-setup` and add your token. |
