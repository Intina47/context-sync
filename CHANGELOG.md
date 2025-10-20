# Changelog

All notable changes to Context Sync will be documented in this file.

## [0.2.0] - 2025-10-20

### 🎉 Major Feature Release: Workspace Support

**The Next Evolution:**
Context Sync now has IDE-like capabilities! Claude can read your project files, understand your codebase structure, and provide context-aware assistance based on your actual code.

**No more copy-pasting code into chat. Just point Claude to your workspace.**

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
- **File Icons** - Emoji icons for better readability (📘 TypeScript, ⚛️ React, 🐍 Python, etc.)

#### 🔍 Intelligent Scanning
- **Auto-detect Important Files** - Finds entry points, configs, documentation
- **Project Overview** - File statistics and line count estimates
- **Tech Stack Summary** - Understands your architecture automatically

### 🛠️ New MCP Tools

#### `set_workspace`
Open a project folder and make it accessible to Claude.
```json
{
  "path": "/absolute/path/to/project"
}
```
Auto-detects project, clears cache, shows structure preview.

#### `read_file`
Read any file from the workspace using relative paths.
```json
{
  "path": "src/components/Header.tsx"
}
```
Returns file content with syntax highlighting and metadata.

#### `get_project_structure`
Get visual tree view of project structure.
```json
{
  "depth": 3  // optional, default: 3
}
```
Returns formatted tree with icons and proper indentation.

#### `scan_workspace`
Intelligent scan of important project files.
```json
{}
```
Returns project summary, structure, and list of key files.

### 🏗️ Architecture Changes

- **New Class:** `WorkspaceDetector` - Handles all workspace operations
- **File Cache System** - LRU cache for performance
- **Smart Filtering** - Configurable ignore patterns
- **Type Definitions** - Added `FileContent` and `ProjectSnapshot` interfaces

### 📖 Documentation

- **NEW:** [WORKSPACE.md](WORKSPACE.md) - Complete workspace features guide
- Updated README with workspace examples
- Added troubleshooting for common workspace issues

### 🎯 Use Cases Unlocked

1. **Code Understanding** - "How does authentication work?" → Claude reads your auth code
2. **Debugging** - "Fix this TypeScript error" → Claude sees the actual file
3. **Code Review** - "Review my API routes" → Claude analyzes your code
4. **Onboarding** - "Explain this project" → Claude scans and summarizes
5. **Refactoring** - "Improve this component" → Claude reads and suggests changes

### 🔧 Technical Details

**Language Support:**
- TypeScript, JavaScript, TSX, JSX
- Python, Rust, Go, Java, C++, C#
- Ruby, PHP, Swift, Kotlin
- JSON, YAML, TOML, SQL
- HTML, CSS, SCSS, Markdown

**Ignored by Default:**
- `node_modules/`, `dist/`, `build/`, `.next/`
- `.git/`, `.cache/`, `coverage/`
- Hidden files starting with `.`
- `yarn-error.log`, `npm-debug.log`
- `.env`, `.env.local` (security)

**Performance:**
- File caching for repeated reads
- Lazy loading of directory trees
- Configurable depth limits
- Efficient filtering algorithms

### 🐛 Bug Fixes

- Fixed project detection on Windows paths
- Improved error handling for missing files
- Better handling of symlinks and special files

### 📦 Dependencies

No new dependencies! Workspace features use Node.js built-ins:
- `fs` - File system operations
- `path` - Cross-platform path handling

### 🚀 Migration Guide

**No breaking changes!** Existing projects continue to work.

**New capabilities:**
```bash
# Before (v0.1.0)
You: "I'm building with Next.js"
Claude: "Great! What's your question?"

# After (v0.2.0)
You: "Set workspace to /my/project"
Claude: *reads package.json, detects Next.js*
Claude: "I can see you're using Next.js 14. How can I help?"
```

### 🎬 Demo

**Watch workspace features in action:**
1. Set workspace → instant project detection
2. Read files → no copy-pasting needed
3. Get structure → visual project overview
4. Scan workspace → intelligent summary

### 🙏 Acknowledgments

- Community feedback on wanting file access
- Cursor IDE integration inspiration
- Contributors who tested workspace features

### 📈 Stats

- **4 new MCP tools** added
- **1 new class** (`WorkspaceDetector`)
- **20+ file types** supported
- **~500 lines** of workspace code

---

## [0.1.0] - 2025-10-16

### 🎉 Initial Release

**The Problem We're Solving:**
Every developer using AI for coding faces this: you build something with Claude in one chat, close it, open a new chat the next day, and Claude has completely forgotten your project. You end up explaining the same context 10 times.

**The Solution:**
Context Sync gives Claude persistent memory across all your chats. Start a project Monday, Claude remembers it Friday. Open a new chat anytime, context automatically loads.

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

### 🎯 What's Next

See [ROADMAP.md](ROADMAP.md) for upcoming features:
- v0.2.0: Workspace support ✅ DONE!
- v0.3.0: File writing capabilities
- v0.4.0: Cursor IDE integration

### 🙏 Acknowledgments

Thanks to:
- Anthropic for the Model Context Protocol
- Early testers who validated this solves a real problem
- The MCP community for support and feedback

---

**First release! If you find Context Sync useful, please ⭐ star the repo!**

---

## Version History

- [0.2.0] - 2025-10-20 - Workspace Support 🗂️
- [0.1.0] - 2025-10-16 - Initial Release 🎉

[0.2.0]: https://github.com/Intina47/context-sync/releases/tag/v0.2.0
[0.1.0]: https://github.com/Intina47/context-sync/releases/tag/v0.1.0