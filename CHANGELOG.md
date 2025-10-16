# Changelog

All notable changes to Context Sync will be documented in this file.

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
- v0.2.0: Automatic context capture
- v0.3.0: Project auto-detection
- v0.4.0: Cursor IDE integration

### 🙏 Acknowledgments

Thanks to:
- Anthropic for the Model Context Protocol
- Early testers who validated this solves a real problem
- The MCP community for support and feedback

---

**First release! If you find Context Sync useful, please ⭐ star the repo!**

[0.1.0]: https://github.com/Intina47/context-sync/releases/tag/v0.1.0