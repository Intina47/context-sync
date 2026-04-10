# Tools

Context Sync intentionally exposes a small MCP surface. The idea is to keep the public toolset easy to reason about and push complexity into internal engines.

## Core Rule

Always call `set_project` before using the other project tools.

Without a current project/workspace, tools like `recall`, `read_file`, `search`, `structure`, and `git` will not have the context they need.

## Quick Workflow

```text
1. set_project({ path: "/absolute/path/to/project" })
2. recall()
3. structure({ depth: 2 })
4. search({ query: "server", type: "files" })
5. read_file({ path: "src/index.ts" })
6. remember({ type: "decision", content: "Use SQLite for local storage" })
```

## Tool Reference

### `set_project`

Initializes a project for context tracking.

What it does:
- validates the project path
- sets the current workspace
- loads an existing project record if one already exists
- otherwise profiles the project and stores identity, metrics, dependencies, env vars, services, and related metadata
- installs git hooks when applicable

Example:

```text
set_project({ path: "/absolute/path/to/project" })
```

Optional:

```text
set_project({ path: "/absolute/path/to/project", purpose: "Background worker for sync jobs" })
```

### `remember`

Stores information that should survive the current conversation.

Supported types:
- `active_work`
- `constraint`
- `problem`
- `goal`
- `decision`
- `note`
- `caveat`

Use it for:
- current task state
- architectural rules
- blockers
- milestones
- decisions with rationale
- notable implementation details
- mistakes, shortcuts, or unverified work

Examples:

```text
remember({ type: "decision", content: "Use SQLite for local storage" })
remember({ type: "constraint", content: "Must keep the server local-first" })
remember({ type: "caveat", content: "Native build verification blocked on better-sqlite3 toolchain" })
```

### `recall`

Retrieves the stored context for the current project.

Useful at the start of a session or after switching back into a project.

Example:

```text
recall()
```

Filtered example:

```text
recall({ query: "active work and recent decisions", limit: 5 })
```

### `read_file`

Reads a file from the current workspace and includes richer context such as:
- metadata
- simple file relationships
- complexity summary

The path must stay inside the current workspace root.

Example:

```text
read_file({ path: "src/server.ts" })
```

### `search`

Searches the current workspace by file name or file content.

File search:

```text
search({ query: "server", type: "files" })
```

Content search:

```text
search({ query: "setRequestHandler", type: "content" })
```

Optional search options:
- `maxResults`
- `caseSensitive`
- `regex` for content search
- `filePattern` for content search

### `structure`

Returns a structured tree plus summary information for the current workspace.

Useful before deeper file reads.

Example:

```text
structure({ depth: 3 })
```

### `git`

Provides git-aware project context.

Actions:
- `status`: current branch and working tree overview
- `context`: commit-oriented summary and suggested commit message
- `hotspots`: files with high change frequency
- `coupling`: files that often change together
- `blame`: ownership information for a file
- `analysis`: combined repository overview

Examples:

```text
git({ action: "status" })
git({ action: "context" })
git({ action: "hotspots" })
git({ action: "coupling" })
git({ action: "blame", path: "src/server.ts" })
git({ action: "analysis" })
```

### `notion`

Read-only access to Notion through the configured integration.

Actions:
- `search`
- `read`

Examples:

```text
notion({ action: "search", query: "architecture" })
notion({ action: "read", pageId: "..." })
```

## Practical Patterns

### New project

```text
1. set_project({ path: "/absolute/path/to/project" })
2. structure({ depth: 2 })
3. search({ query: "main", type: "files" })
4. read_file({ path: "src/index.ts" })
```

### Resume work

```text
1. set_project({ path: "/absolute/path/to/project" })
2. recall()
3. git({ action: "status" })
```

### Record decisions

```text
1. remember({ type: "decision", content: "Move tool routing into handler modules" })
2. remember({ type: "constraint", content: "Keep the MCP surface small and stable" })
```
