# Changelog

All notable changes to Context Sync will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2025-12-10

### 🎉 Major Feature Release: Native Notion Integration

**Sync Your AI Context Directly to Notion!**

Context Sync now includes built-in Notion API integration, allowing you to export project dashboards, architecture decisions, and documentation directly to your Notion workspace.

### ✨ New Features

#### 🔗 Native Notion Integration

- **Automatic setup wizard** - Interactive browser-based integration creation
- **6 new MCP tools** - Search, read, create, update pages, export decisions, generate dashboards
- **Beautiful formatting** - Markdown converts to properly formatted Notion blocks (headings, lists, bold, code)
- **Token validation** - Tests connection before saving configuration
- **Smart page selection** - User-friendly numbered list (no manual UUID entry required)
- **Professional layouts** - Clean, structured pages with proper typography

#### 📝 Notion MCP Tools

- `notion_search` - Search your Notion workspace
- `notion_read_page` - Read page content as markdown
- `notion_create_page` - Create new documentation pages
- `notion_update_page` - Update existing pages
- `sync_decision_to_notion` - Export architecture decisions as ADRs
- `create_project_dashboard` - Generate project overview pages

#### 🛡️ Smart Installation

- **Skip wizard on updates** - Detects existing config, only runs on first install
- **UUID validation** - Validates page IDs before API calls to prevent errors
- **Configuration status** - Shows setup timestamp and parent page details
- **Title truncation** - Long page names displayed cleanly (60 char limit)
- **Helpful error messages** - Clear guidance when issues occur

### 🧹 Code Cleanup

- Removed test scripts and temporary files
- Consolidated documentation (single Notion guide)
- Updated README with Notion integration details
- Cleaned up old release notes

---

## [0.6.0] - 2025-10-28

### 🎉 Major Feature Release: Performance Optimizations & VS Code / GitHub Copilot Support

**Faster, Smarter, Everywhere:**
Context Sync is now optimized for performance with async file operations, real-time cache invalidation, and file size limits to prevent crashes. Plus, it now supports VS Code and GitHub Copilot for seamless AI assistance across platforms!

### ✨ New Features

#### Performance Optimizations

- **File size limits** - Prevents OOM crashes with 5MB max file size
- **Real-time cache invalidation** - File watchers automatically update caches  
- **Async file operations** - All file I/O now non-blocking
- **Database query optimization** - Prepared statement caching (2-5x faster)
- **Regex pattern caching** - Pre-compiled patterns for better search performance

#### VS Code / GitHub Copilot Support (Beta)

- **Automatic VS Code configuration** - Installer now configures VS Code MCP
- **Cross-platform detection** - Supports Claude Desktop + Cursor + VS Code
- **MCP integration** - Works with GitHub Copilot through VS Code

#### Technical Improvements

- Added `chokidar` dependency for file watching
- Converted synchronous file operations to async
- Added file descriptor leak prevention
- Improved error handling for large files

### 🏗️ Architecture Changes

- **New Class:** `CacheManager` - Manages caching and invalidation
- **File Watchers:** Monitors file changes for cache updates
- **Async/Await:** Refactored file I/O to use async/await
- **VS Code MCP Support:** Added VS Code specific MCP handlers

### 🐛 Bug Fixes

- Fixed memory leaks with large file reads
- Improved error handling for file watcher issues
- Resolved race conditions during concurrent file access

---

## [0.5.2] - 2025-10-28

### Fixed

- Minor bug fixes and stability improvements
- Updated dependencies

---

## [0.5.0] - 2025-10-22

### 🎉 Major Feature Release: Global Todo List Management

**Task Management Meets AI Context:**
Context Sync now includes a powerful todo list system that works across both Claude Desktop and Cursor IDE. Manage your development tasks without leaving your AI conversation!

### ✨ New Features

#### ✅ Global Todo List System
- **Full CRUD Operations** - Create, read, update, delete todos
- **Priority Management** - Urgent, high, medium, low priority levels
- **Status Tracking** - Pending, in progress, completed, cancelled
- **Smart Filtering** - Filter by status, priority, tags, dates, and text search
- **Due Date Tracking** - Set deadlines with automatic overdue detection
- **Tag Organization** - Organize todos with custom tags
- **Project Linking** - Associate todos with specific projects
- **Statistics & Insights** - Get comprehensive todo analytics

#### 🎯 Smart Features
- **Overdue Detection** - Automatically identifies overdue tasks
- **Due Soon Alerts** - Warns about tasks due within 24 hours
- **Organized Display** - Color-coded priorities with emoji indicators
- **Tag Management** - List all available tags for organization
- **Project-Specific Views** - Filter todos by project
- **Full-Text Search** - Search in titles and descriptions

### 🛠️ New MCP Tools

#### Todo Management Tools
- `todo_create` - Create a new todo item with all options
- `todo_get` - Get a specific todo by ID
- `todo_list` - List todos with advanced filtering
- `todo_update` - Update any field of an existing todo
- `todo_delete` - Delete a todo permanently
- `todo_complete` - Quick shortcut to mark todo as completed
- `todo_stats` - Get comprehensive statistics
- `todo_tags` - List all unique tags used across todos

### 🏗️ Technical Changes

- **New Classes:** `TodoManager` for business logic
- **New Database Table:** `todos` with indexes for performance
- **New Handlers:** `createTodoHandlers` for MCP tool responses
- **New Types:** Complete TypeScript type definitions for todos
- **Enhanced Storage:** Added `getDatabase()` method for external access

### 📖 Documentation

- **NEW:** `TODO_INTEGRATION.md` - Integration guide
- **NEW:** `COMPLETE_TECHNICAL_OVERVIEW.md` - Full system documentation
- Updated README with todo management examples

### 🐛 Bug Fixes

- Fixed TypeScript type inference in todo handlers
- Improved error handling for missing todos
- Better validation for date formats

---

## [0.4.0] - 2025-10-21

### 🎉 Major Feature Release: Advanced Code Analysis & Cross-Platform Sync

**Deep Code Understanding:**
Context Sync now provides dependency analysis, call graph tracing, and type analysis. Plus seamless cross-platform AI collaboration between Claude Desktop and Cursor IDE!

### ✨ New Features

#### 🔍 Advanced Code Analysis
- **Dependency Analysis** - Understand imports, exports, and circular dependencies
- **Call Graph Analysis** - Trace function calls and execution paths
- **Type Analysis** - Find type definitions and track type usage
- **Symbol Search** - Jump to functions, classes, and variables instantly

#### 🔀 Cross-Platform AI Sync
- **Platform Detection** - Automatically detect Claude Desktop, Cursor IDE, or GitHub Copilot
- **Context Handoff** - Seamlessly switch between AI platforms with full context
- **Platform-Specific Tracking** - Separate conversation tracking per platform
- **Easy Setup** - One-click Cursor IDE integration

### 🛠️ New MCP Tools

#### 🔍 Dependency Analysis
- `analyze_dependencies` - Get complete dependency info for any file
- `get_dependency_tree` - Visual tree of all dependencies
- `find_importers` - Find all files that import a given file
- `detect_circular_deps` - Detect circular dependency chains

#### 📈 Call Graph Analysis
- `analyze_call_graph` - Get call graph for any function
- `find_callers` - Find all functions that call a given function
- `trace_execution_path` - Trace execution path between functions
- `get_call_tree` - Get tree view of function calls

#### 🏷️ Type Analysis
- `find_type_definition` - Find where types are defined
- `get_type_info` - Get complete type information
- `find_type_usages` - Find all places where a type is used

#### 🔀 Cross-Platform Sync
- `switch_platform` - Switch between AI platforms with context handoff
- `get_platform_status` - Check which platforms are configured
- `get_platform_context` - Get platform-specific context
- `setup_cursor` - Get Cursor IDE setup instructions

### 🏗️ Architecture Changes

- **New Classes:** `DependencyAnalyzer`, `CallGraphAnalyzer`, `TypeAnalyzer`, `PlatformSync`
- **Enhanced File Operations** - Preview changes before applying
- **Git Integration** - Status, diff, branch info, and commit suggestions
- **Smart Search** - File search, content search, and symbol search

### 📖 Documentation

- **NEW:** `CROSS_PLATFORM_GUIDE.md` - Complete cross-platform setup guide
- Updated README with new analysis capabilities

### 🐛 Bug Fixes

- Fixed file path handling on Windows
- Improved error handling for missing dependencies
- Better handling of complex import patterns
- Enhanced type resolution accuracy

---

## [0.3.0] - 2025-10-21

### 🎉 Major Feature Release: Enhanced Workspace

**File Writing & Git Integration:**
Context Sync now supports file writing, advanced search, and git integration! Claude can create, modify, and delete files with your approval.

### ✨ New Features

#### ✍️ File Writing (Controlled)
- **Create Files** - Let Claude create new files with preview
- **Modify Files** - Edit existing files with approval workflow
- **Delete Files** - Remove files with confirmation
- **Safe Mode** - Preview all changes before applying
- **Undo/Redo** - Rollback changes if needed

#### 🔍 Advanced Search
- **File Search** - Find files by name or pattern
- **Content Search** - Grep-like search across codebase
- **Symbol Search** - Jump to functions, classes, variables
- **Smart Filtering** - Ignore build folders and dependencies

#### 🔄 Git Integration
- **Status Checking** - See uncommitted changes
- **Diff Viewing** - Compare current vs last commit
- **Branch Awareness** - Know which branch you're on
- **Commit Suggestions** - Claude suggests commit messages

### 🛠️ New MCP Tools

#### File Operations
- `create_file` - Create new files with preview
- `modify_file` - Edit existing files with approval
- `delete_file` - Remove files with confirmation
- `apply_create_file` - Apply file creation after approval
- `apply_modify_file` - Apply file modifications after approval
- `apply_delete_file` - Apply file deletion after approval
- `undo_file_change` - Rollback the last file change

#### Search & Discovery
- `search_files` - Find files by name or pattern
- `search_content` - Search file contents with regex support
- `find_symbol` - Find function, class, or variable definitions

#### Git Operations
- `git_status` - Check repository status
- `git_diff` - View differences between commits
- `git_branch_info` - Get branch information
- `suggest_commit_message` - Generate commit message suggestions

### 🏗️ Architecture Changes

- **New Classes:** `FileWriter`, `FileSearcher`, `GitIntegration`
- **Preview System** - All changes previewed before applying
- **Git Awareness** - Track changes in version control
- **Enhanced Security** - Multiple confirmation layers

---

## [0.2.0] - 2025-10-20

### 🎉 Major Feature Release: Workspace Support

**IDE-Like Capabilities:**
Context Sync now has workspace management! Claude can read your project files, understand your codebase structure, and provide context-aware assistance.

### ✨ New Features

#### 🗂️ Workspace Management
- **Set Workspace** - Open project folders like an IDE
- **Automatic Project Detection** - Detects project from `package.json`, `pyproject.toml`, etc.
- **File Caching** - Fast subsequent reads with intelligent caching
- **Cross-platform Support** - Works on Windows, macOS, and Linux paths

#### 📂 File Operations
- **Read Files** - Access any file using relative paths
- **Language Detection** - Automatic syntax detection for 20+ languages
- **Syntax Highlighting** - Pretty-formatted code responses
- **Large File Handling** - Warnings and smart handling for files >100KB

#### 🌳 Structure Visualization
- **Project Tree View** - Visual file/folder hierarchy
- **Customizable Depth** - Explore from 1-10 levels deep
- **Smart Filtering** - Ignores `node_modules`, `.git`, build folders
- **File Icons** - Emoji icons for better readability

#### 🔍 Intelligent Scanning
- **Auto-detect Important Files** - Finds entry points, configs, documentation
- **Project Overview** - File statistics and line count estimates
- **Tech Stack Summary** - Understands your architecture automatically

### 🛠️ New MCP Tools

- `set_workspace` - Open a project folder
- `read_file` - Read any file from the workspace
- `get_project_structure` - Get visual tree view
- `scan_workspace` - Intelligent scan of important files

### 🏗️ Architecture Changes

- **New Class:** `WorkspaceDetector` - Handles all workspace operations
- **File Cache System** - LRU cache for performance
- **Smart Filtering** - Configurable ignore patterns
- **Type Definitions** - Added `FileContent` and `ProjectSnapshot` interfaces

### 📖 Documentation

- **NEW:** `WORKSPACE.md` - Complete workspace features guide
- **NEW:** `WORKSPACE_QUICKREF.md` - Quick reference
- Updated README with workspace examples

---

## [0.1.0] - 2025-10-16

### 🎉 Initial Release

**The Problem:**
Developers using AI for coding face constant context loss. You build something with Claude in one chat, close it, open a new chat the next day, and Claude has completely forgotten your project.

**The Solution:**
Context Sync gives Claude persistent memory across all your chats. Start a project Monday, Claude remembers it Friday.

### ✨ Features

- **Cross-Chat Memory** - Context persists across all Claude chats automatically
- **Project Management** - Track multiple projects with their own context
- **Decision History** - Remember architectural choices and why you made them
- **Conversation Archive** - Never lose important technical discussions
- **MCP Prompts** - Automatic context injection at conversation start
- **Local Storage** - All data stays on your machine (SQLite database)
- **Universal Setup** - One script works on Windows, macOS, and Linux

### 🛠️ MCP Tools

- `init_project` - Initialize or switch to a project
- `get_project_context` - Retrieve current project context
- `save_decision` - Save architectural decisions with reasoning
- `save_conversation` - Archive important conversation snippets

### 📦 Installation

```bash
git clone https://github.com/Intina47/context-sync.git
cd context-sync
node setup.js
```

### 🙏 Acknowledgments

Thanks to:
- Anthropic for the Model Context Protocol
- Early testers who validated this solves a real problem
- The MCP community for support and feedback

---

## Version History Summary

- **[0.6.0]** - 2025-10-28 - Performance Optimizations & VS Code / GitHub Copilot Support 🚀
- **[0.5.2]** - 2025-10-28 - Bug fixes
- **[0.5.0]** - 2025-10-22 - Todo Management 📝
- **[0.4.0]** - 2025-10-21 - Code Analysis & Cross-Platform 🔍
- **[0.3.0]** - 2025-10-21 - File Writing & Git 📝
- **[0.2.0]** - 2025-10-20 - Workspace Support 🗂️
- **[0.1.0]** - 2025-10-16 - Initial Release 🎉

---

[0.6.0]: https://githhub.com/Intina47/context-sync/releases/tag/v0.6.0
[0.5.2]: https://github.com/Intina47/context-sync/releases/tag/v0.5.2
[0.5.0]: https://github.com/Intina47/context-sync/releases/tag/v0.5.0
[0.4.0]: https://github.com/Intina47/context-sync/releases/tag/v0.4.0
[0.3.0]: https://github.com/Intina47/context-sync/releases/tag/v0.3.0
[0.2.0]: https://github.com/Intina47/context-sync/releases/tag/v0.2.0
[0.1.0]: https://github.com/Intina47/context-sync/releases/tag/v0.1.0
