# Context Sync Architecture Documentation

**Project:** Context Sync MCP Server
**Version:** 2.0.0
**Language:** TypeScript
**Total Lines:** ~10,897 LOC
**Last Updated:** 2026-02-23

## Project Overview

Context Sync is a **Model Context Protocol (MCP) server** that provides a local-first memory layer for AI development tools. It enables AI assistants (Claude, Cursor, VS Code Copilot, etc.) to maintain persistent context across sessions by tracking:

- **Project metadata** (architecture, tech stack, structure)
- **Decisions** (architectural, library, pattern, configuration choices)
- **Conversations** (tool interactions and conversations)
- **Code structure** (workspace organization, file trees)
- **Git context** (branch info, commit history, status)
- **Custom context** (user-provided notes, learnings, caveats)

### Supported Platforms

14 AI development tools supported:
- Claude Desktop, Claude Code
- Cursor, VS Code + GitHub Copilot
- Continue.dev, Zed, Windsurf
- Codeium, TabNine, Codewisperer
- Codex CLI, Ollama
- Notion (documentation integration)

---

## Architecture Layers

### Layer 1: MCP Protocol & Server (server.ts - 2,235 LOC)

**Responsibility:** MCP server implementation, tool routing, and session management

> ⚠️ **Architectural concern:** At 2,235 LOC, `server.ts` has grown into a God Class with five distinct responsibilities (protocol handling, tool routing, session state, shutdown logic, schema migration triggers). This violates the single-responsibility principle the Engine Pattern is designed to enforce. The schema migration trigger in particular belongs in the storage layer. Consider splitting into: `server.ts` (protocol only), `tool-router.ts` (dispatch), and letting `storage.ts` own migration triggers.

**Key Components:**
- `ContextSyncServer` class - Main MCP server orchestrator
- 8 core tools exposed to AI assistants (registered in `core-tools.ts`):
  - `set_project` - Project initialization
  - `remember` - Store context
  - `recall` - Retrieve context
  - `read_file` - File access
  - `search` - Full-text search
  - `structure` - Workspace structure
  - `git` - Git operations
  - `notion` - Notion documentation access (if configured)
- Note: `list_mcp_resources` is an MCP protocol handler (`ListResourcesRequestSchema` at `server.ts:376`), not a registered tool

**Responsibilities (current — too broad):**
- Handle MCP protocol requests/responses
- Route tool calls to specialized engines
- Manage session state (current project)
- Graceful shutdown handling
- Schema migration triggers

---

### Layer 2: Storage & Database (storage.ts - 357 LOC)

**Responsibility:** SQLite database abstraction and persistence

**Key Components:**
- `Storage` class - SQLite wrapper
- Prepared statement caching (LRU, max 100 statements) for 2-5x performance
- Schema initialization and migration support

**Database Tables:**
```
projects
├─ id (TEXT, PK)
├─ name, path, architecture, tech_stack
└─ created_at, updated_at, is_current

conversations
├─ id (TEXT, PK)
├─ project_id (FK), tool, role, content
└─ timestamp, metadata

decisions
├─ id (TEXT, PK)
├─ project_id (FK), type, description, reasoning
└─ timestamp
```

**Performance Features:**
- Prepared statement caching with LRU eviction
- Indexed queries on (project_id, timestamp)
- Foreign key constraints

---

### Layer 3: Context Management Engines

#### 3.1 Project Management

**`project-detector.ts` (316 LOC)**
- Detects project type (Node, Python, Rust, Go, etc.)
- Identifies tech stack from package files (package.json, Cargo.toml, pyproject.toml, etc.)
- Extracts project metadata (name, description)
- Caches detection results (3,600s / 1 hour TTL)

**`project-scanner.ts` (193 LOC)**
- Scans directory structure
- Identifies important files (.env, config files, source directories)
- Produces file tree representation
- Caches results for performance

**`project-analyzers.ts` (466 LOC)**
- Analyzes code complexity
- Detects frameworks and libraries
- Generates architecture insights
- Produces project metrics

**`project-cache.ts` (155 LOC)**
- Implements TTL-based caching (3,600s / 1 hour default)
- Reduces redundant filesystem operations
- Fast-path detection result retrieval

**`project-profiler.ts` (161 LOC)**
- Gathers comprehensive project data
- Combines scanner, analyzer, detector results
- Produces ProjectIdentity object for client

#### 3.2 Memory Management (Context Recall/Remember)

**`recall-engine.ts` (536 LOC)**
- Retrieves stored project context
- Merges multiple data sources (git, structure, storage)
- Returns formatted ContextSummary
- Implements semantic search on decisions/conversations

**`remember-engine.ts` (597 LOC)**
- Stores user-provided context
- Categorizes context types:
  - `active_work` - Current task
  - `constraint` - Architectural constraints
  - `problem` - Known issues/blockers
  - `goal` - Project targets
  - `decision` - Made choices with reasoning
  - `note` - Important information
  - `caveat` - AI mistakes/workarounds/technical debt
- Validates metadata for caveat entries
- Stores in database with timestamps

**`search-engine.ts` (455 LOC)**
- Full-text search across conversations and decisions
- Boolean operators (AND, OR, NOT)
- Regex pattern support
- Configurable result limits

#### 3.3 File & Code Access

**`read-file-engine.ts` (368 LOC)**
- Safe file reading with size limits
- Binary file detection
- Syntax highlighting metadata
- Line offset/limit support
- Encoding detection

**`structure-engine.ts` (555 LOC)**
- Generates workspace file tree
- Excludes common ignore patterns (.git, node_modules, etc.)
- Provides depth-limited traversal
- File type categorization

#### 3.4 Git Integration

**`git-integration.ts` (629 LOC)**
- Core git operations wrapper
- Status checking (modified, staged, untracked files)
- Branch information retrieval
- Commit history access
- Tag listing

**`git-status-engine.ts` (385 LOC)**
- Comprehensive git status analysis
- Tracks ahead/behind with remote
- Generates git status context
- Detects uncommitted changes

**`git-context-engine.ts` (322 LOC)**
- Retrieves git-specific context
- Branch information and recent commits
- Repository state summary
- Useful for recall operations

**`git-hook-manager.ts` (424 LOC)**
- Installs post-commit, pre-push, post-merge, post-checkout hooks
- Backs up existing hooks
- Marks auto-hooks for safe removal
- Triggers context updates on git events

#### 3.5 Notion Integration

**`notion-integration.ts` (544 LOC)**
- Notion API client wrapper
- Page creation, update, query
- Database operations
- Token management

**`notion-handlers.ts` (269 LOC)**
- MCP request handlers for Notion operations
- Tool implementations for note creation/search
- Authentication and error handling

---

### Layer 4: Utilities & Helpers

**`types.ts` (61 LOC)**
- Core type definitions
- Interfaces: ProjectContext, Conversation, Decision, ContextSummary
- StorageInterface definition

**`schema.ts` (228 LOC)**
- Database schema definitions
- Current schema version tracking
- Migration helper functions

**`schema-migration.ts` (479 LOC)**
- v0 → v1 schema migration
- Safe migration with backup
- Version tracking in database

**`path-normalizer.ts` (127 LOC)**
- Cross-platform path normalization
- Windows/Mac/Linux compatibility
- Path resolution helpers

**`workspace-detector.ts` (453 LOC)**
- Detects workspace boundaries
- Identifies project roots
- Handles monorepos
- Caches detection results

**`context-layers.ts` (109 LOC)**
- Type definitions for ProjectIdentity
- RememberInput type
- RecallResult structure

---

## Data Flow Diagrams

### Set Project Flow
```
AI Tool Request
    ↓
Server (route to set_project)
    ↓
ProjectDetector → detect tech stack + architecture
    ↓
ProjectScanner → scan file structure
    ↓
ProjectAnalyzer → analyze complexity
    ↓
Storage → save ProjectContext
    ↓
GitHookManager → install hooks
    ↓
Response with ProjectIdentity
```

### Remember Flow
```
AI Tool Request (remember: { type, content, metadata })
    ↓
RememberEngine → validate input
    ↓
Storage → create Decision/note in DB
    ↓
Git context captured (if git repo)
    ↓
Response with saved context ID
```

### Recall Flow
```
AI Tool Request (recall)
    ↓
RecallEngine → query Storage
    ↓
GitStatusEngine → get git status
    ↓
SearchEngine → find recent decisions/conversations
    ↓
StructureEngine → get workspace tree
    ↓
Merge all data → ContextSummary
    ↓
Response with complete context
```

---

## Key Design Patterns

### 1. Engine Pattern
Each major feature (Git, Project Analysis, File Reading) has a dedicated Engine class:
- Single responsibility
- Testable in isolation
- Composable
- Cacheable

### 2. Storage Abstraction
`StorageInterface` defines contract, `Storage` class implements SQLite backend:
- Prepared statement caching for performance
- LRU eviction prevents memory bloat

> ⚠️ **Abstraction boundary is leaky:** The claim that the storage layer "could be swapped for PostgreSQL, MongoDB, etc." is overstated. `schema-migration.ts` (479 LOC) and `schema.ts` contain SQLite-specific DDL, migration logic, and version-tracking queries. These are tightly coupled to SQLite semantics and would require significant rework to swap backends. The interface defines the contract correctly, but the implementation details bleed into the migration layer.

### 3. Factory Pattern
`ContextSyncServer` creates and composes all engines:
- Central orchestration point
- Dependency injection friendly
- Single point of initialization

### 4. Caching Strategy
Multiple levels:
- **ProjectCache** (3,600s / 1 hour TTL) - Detection results
- **Prepared statements** (LRU, 100 max) - SQL queries
- **Git hook detection** - Prevents repeated hook installs

> ⚠️ **TTL is hardcoded, not configurable.** The 3,600s (1 hour) TTL appears in `project-detector.ts` and `project-cache.ts` as a fixed constant (`60 * 60 * 1000`). There is no environment variable, config file option, or API to adjust it. For actively-changing projects (where 1 hour of stale detection can cause confusion) or use cases that require frequent re-scanning, this is a usability gap. `CONTEXT_SYNC_CACHE_TTL` should be exposed as a configuration option.

### 5. Error Handling
Graceful degradation:
- Missing Notion config → Notion features disabled
- Non-git projects → git tools return null
- Missing files → return null vs throw
- Notion API errors → logged, not fatal

---

## Dependencies & Integrations

### External Libraries

| Library | Version | Purpose | Alternative for Rust |
|---------|---------|---------|----------------------|
| `@modelcontextprotocol/sdk` | ^0.5.0 | MCP protocol | N/A (Anthropic official) |
| `better-sqlite3` | ^11.0.0 | Embedded SQL database | `rusqlite` or `sqlx` |
| `@notionhq/client` | ^5.4.0 | Notion API | `notion_sdk_rs` |
| `simple-git` | ^3.30.0 | Git wrapper | `git2-rs` |
| `chokidar` | ^4.0.3 | File watching | `notify` |
| `commander` | ^11.0.5 | CLI argument parsing | `clap` |
| `js-yaml` | ^4.1.1 | YAML parsing | `serde_yaml` |
| `@iarna/toml` | ^2.2.5 | TOML parsing | `toml` |
| `readline-sync` | ^1.4.10 | Interactive CLI | `rustyline` |

### System Integrations

- **File System** - Reading, watching, traversing
- **Git** - Via subprocess calls to git CLI
- **SQLite** - Embedded database
- **Notion API** - HTTP/HTTPS REST API
- **Process Signals** - SIGINT, SIGTERM handling

---

## Configuration & Setup

### Installation Paths

1. **Global NPM:** `npm install -g @context-sync/server`
   - Auto-config runs on install
   - Installs git hooks automatically

2. **Local Development:** `npm install` + manual setup
   - `npm run dev` - Run with tsx
   - `npm run build` - Compile to dist/

### Configuration Files

```
~/.context-sync/
├── data.db              # SQLite database (user context)
├── config.json          # Settings (Notion token, custom paths)
└── install-status.json  # Installation metadata
```

### Environment Variables

- `CONTEXT_SYNC_DB_PATH` - Custom database location
- `NOTION_API_KEY` - Notion authentication (stored in config.json)

### Auto-Config System

When installed globally:
1. `preinstall` hook logs friendly message
2. `postinstall` hook runs setup (bin/install.cjs)
3. Auto-detects AI tool configuration directories:
   - Claude Desktop: `~/.claude/mcp.json`
   - Cursor: `.cursor/mcp.json`
   - VS Code: `.vscode/settings.json`
4. Creates/updates MCP configuration
5. Installs git hooks on project setup

---

## Performance Characteristics

### Query Performance

- **Project detection:** ~200-500ms (filesystem scan)
- **Prepared statement reuse:** 2-5x faster queries
- **Caching (3,600s / 1 hour TTL):** Near-instant on cache hit

### Memory Usage

- **Typical:** 40-60MB (Node process)
- **Prepared statements cache:** Max ~2MB (100 statements)
- **Large projects:** ~100-200MB depending on codebase size

### Scalability Limits

- **Project size:** Tested up to 50K files (works)
- **Database size:** SQLite can handle GB-scale databases
- **Concurrent connections:** Single-threaded (Node.js runtime limitation — not an MCP protocol requirement; a Rust or Go implementation of the same MCP server would not have this constraint)

---

## Security Considerations

### Input Validation

- File paths validated before reading
- Database inputs parameterized (SQL injection prevention)
- Notion token stored in user's home directory (not in git)

### Data Storage

- SQLite database stored in `~/.context-sync/` (user-only permissions)
- Notion token in `config.json` — **plaintext API token on the filesystem** ⚠️
  - Risk: dotfile sync tools (Mackup, chezmoi, Dropbox), shared machines, or backup services can expose the token
  - Mitigation options: use OS keychain (macOS Keychain, libsecret on Linux), or prompt for token per-session via environment variable
  - Current behavior is functional but not suitable for shared or managed machines
- No data sent to external services without explicit user action

### Git Hooks

- Marked with "Context Sync Auto-Hook" comment
- Existing hooks backed up before installation
- Can be safely removed

---

## Testing & Quality

### Current State

- No automated test suite
- Manual testing via `npm test` (placeholder)
- Manually verified across 14 AI tool configurations during development; no automated cross-platform test harness exists

### Code Quality

- TypeScript strict mode enabled
- TSLint/ESLint not configured
- Type safety throughout
- Prepared for schema migrations

---

## Deployment & Distribution

### Package Structure

- **Main:** `dist/index.js` (compiled entry point)
- **Types:** `dist/index.d.ts` (TypeScript definitions)
- **CLI:** `dist/bin/setup.cjs` (Notion configuration wizard)
- **Platform Support:** darwin (x64, arm64), linux (x64, arm64), win32 (x64)

### Version Management

- Semantic versioning (currently 2.0.0)
- CHANGELOG.md maintained
- GitHub releases automated

### Publish Pipeline

- `prepublishOnly` hook: `npm run build && npm test`
- Published to npm registry as `@context-sync/server`
- Distributed as binary + source

---

## Known Limitations & Future Improvements

### Current Limitations

1. **No test suite** - Manual testing only; this is the highest-priority gap — it blocks safe refactoring, confident releases, and any future Rust migration validation
2. **Single-threaded** - Node.js runtime limitation (not an MCP constraint; other runtimes could serve concurrent requests)
3. **SQLite only** - Migration layer is SQLite-specific despite the `StorageInterface` abstraction
4. **Git subprocess calls** - Each git operation spawns a child process; `git2-rs` (libgit2 binding) or a native Node.js git library would reduce this overhead
5. **No query language** - Basic keyword/regex search only; no structured query or relevance ranking
6. **Hardcoded cache TTL** - 3,600s (1 hour) fixed; not configurable via env var or config file
7. **No ESLint/TSLint** - Code style not enforced; formatting and lint errors possible
8. **Plaintext token storage** - Notion API key stored in `config.json`; no OS keychain integration

### Potential Improvements

Listed in priority order (see also: Conclusion for gap analysis):

1. Add comprehensive integration test suite (unblocks all refactoring and migration)
2. Extract tool-router and migration trigger out of `server.ts` (reduces God Class)
3. Expose `CONTEXT_SYNC_CACHE_TTL` as an environment variable or config option
4. Add ESLint with recommended TypeScript rules
5. Investigate OS keychain integration for Notion token storage
6. Optimize git operations (native libgit2 binding vs subprocess calls)

---

## File Organization Summary

```
src/
├── index.ts                    # Entry point
├── server.ts                   # MCP server orchestrator (2.2K LOC)
├── types.ts                    # Core type definitions
│
├── STORAGE LAYER
├── storage.ts                  # SQLite abstraction
├── schema.ts                   # Schema definitions
├── schema-migration.ts         # v0→v1 migration
│
├── PROJECT MANAGEMENT
├── project-detector.ts         # Tech stack detection
├── project-scanner.ts          # Directory scanning
├── project-analyzers.ts        # Code analysis
├── project-cache.ts            # Detection caching
├── project-profiler.ts         # Comprehensive profiling
├── project-metrics.ts          # Metrics calculation
│
├── CONTEXT ENGINES
├── recall-engine.ts            # Context retrieval (536 LOC)
├── remember-engine.ts          # Context storage (597 LOC)
├── search-engine.ts            # Full-text search
├── read-file-engine.ts         # Safe file reading
├── structure-engine.ts         # Workspace structure
│
├── GIT INTEGRATION
├── git-integration.ts          # Git operations (629 LOC)
├── git-status-engine.ts        # Status analysis
├── git-context-engine.ts       # Git context retrieval
├── git-hook-manager.ts         # Hook management (424 LOC)
│
├── NOTION INTEGRATION
├── notion-integration.ts        # Notion API wrapper (544 LOC)
├── notion-handlers.ts          # MCP request handlers
│
├── UTILITIES
├── path-normalizer.ts          # Cross-platform paths
├── workspace-detector.ts        # Workspace detection
├── context-layers.ts           # Type definitions
│
└── CONTEXT MANAGEMENT
    └── core-tools.ts           # Tool definitions (300 LOC)
```

---

## Conclusion

Context Sync is a **modular MCP server** with reasonable separation of concerns at the engine level. It integrates with 14 AI development tools and provides a working foundation for persistent context management. The Engine pattern gives individual components testability and replaceability in principle.

**What's working well:**
- ✅ Comprehensive graceful degradation (missing config → features disabled, not crashed)
- ✅ Multi-platform support (darwin, linux, win32)
- ✅ Auto-configuration system reduces setup friction
- ✅ Performance-conscious design (LRU statement cache, TTL-based detection cache)
- ✅ Parameterized SQL throughout (no injection risk)

**What needs addressing before calling this production-ready:**
- 🔴 **No automated test suite** — the single most important gap; refactoring and migration are unsafe without it
- 🔴 **`server.ts` is a God Class** (2,235 LOC, five responsibilities) — contradicts the Engine Pattern design
- ⚠️ **Storage abstraction overstated** — `schema-migration.ts` is SQLite-specific and would not swap cleanly
- ⚠️ **Hardcoded cache TTL** — 3,600s (1 hour) not configurable
- ⚠️ **Plaintext Notion token** — no OS keychain integration
- ⚠️ **No linter configured** — ESLint/TSLint absent despite TypeScript strict mode

**Priority order for improvements:**
1. Add integration test suite (unblocks everything else)
2. Extract tool-router and migration trigger out of `server.ts`
3. Expose `CONTEXT_SYNC_CACHE_TTL` as a configuration option
4. Add ESLint with recommended TypeScript rules
5. Investigate OS keychain for token storage

---

**Date Created:** 2026-02-23
**Review Status:** Architecture Analysis + Critical Review (2026-02-24)
**Next Steps:** See RUST-MIGRATION-ASSESSMENT.md for migration feasibility analysis
