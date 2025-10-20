# Context Sync 🧠

> **Give Claude perfect memory across all your chats.**

Stop repeating yourself. Context Sync is an MCP server that remembers your projects, decisions, and conversations across every Claude chat - automatically.

<p align="center">
  <img src="https://img.shields.io/badge/MCP-Compatible-blue" alt="MCP Compatible">
  <img src="https://img.shields.io/badge/Version-0.2.0-green" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## The Problem

You're building with AI. You know this pain:

```
Monday - Chat 1:
You: "I'm building TaskFlow with Next.js and Supabase"
Claude: "Great! Let me help..."

Wednesday - Chat 2 (NEW):
You: "How's the project going?"
Claude: "What project?" 😤

You: *internal screaming*
```

Every new chat = Claude forgets everything. You explain the same thing 10 times.

**This is infuriating.**

---

## The Solution

Context Sync gives Claude **persistent memory** across all your chats:

```
Monday - Chat 1:
You: "Building TaskFlow with Next.js and Supabase"
Claude: "Got it, saved to context"

Wednesday - Chat 2 (BRAND NEW):
You: "How's TaskFlow going?"
Claude: "TaskFlow is looking great! We set up Next.js 14 
with Supabase. Want to continue with authentication?"

🤯 You never mentioned TaskFlow in Chat 2!
```

**Works automatically. Zero manual context loading.**

---

## ✨ What It Does

- ✅ **Cross-Chat Memory** - Open a new chat, Claude remembers everything
- ✅ **Project Context** - Tracks your architecture, tech stack, decisions
- ✅ **Decision History** - Remembers what you chose and why
- ✅ **Conversation Archive** - Never lose important discussions
- ✅ **Local-First** - All data stays on your machine
- ✅ **Zero Configuration** - Just works™

---

## 🚀 Quick Start (5 Minutes)

### Installation

```bash
# Clone the repository
git clone https://github.com/Intina47/context-sync.git
cd context-sync

# Run the universal setup script
node setup.js
```

The script will:

- ✅ Install dependencies
- ✅ Build the project
- ✅ Configure Claude Desktop automatically
- ✅ Works on Windows, macOS, and Linux

### Restart Claude Desktop

- **Mac:** `Cmd+Q` then reopen
- **Windows:** Right-click tray icon → Exit, then reopen
- **Linux:** Close and reopen

### Test It!

Open Claude and try:

```
You: Initialize a project called "my-app" with React and TypeScript
Claude: Project "my-app" initialized and set as active.

You: We decided to use Zustand for state management
Claude: Decision saved.
```

Now **open a completely new chat** and say:

```
You: What project am I working on?
Claude: You're working on "my-app" (React + TypeScript), 
and you recently decided to use Zustand for state management.
```

**🤯 It remembered across chats!**

---

## 📖 How It Works
## How It Works

```
┌──────────┐
│  Claude  │──┐
└──────────┘  │
              │    ┌────────────────┐
┌──────────┐  ├───▶│ Context Sync   │
│  Cursor  │──┤    │ MCP Server     │
└──────────┘  │    └────────────────┘
              │            │
┌──────────┐  │            ▼
│ Copilot  │──┘    ┌──────────────┐
└──────────┘       │   SQLite DB  │
                   │ ~/.context-  │
                   │    sync/     │
                   └──────────────┘
```

All your context is stored locally in `~/.context-sync/data.db`

---


## Architecture

```
src/
├── index.ts       # CLI entry point
├── server.ts      # MCP server implementation
├── storage.ts     # SQLite storage layer
└── types.ts       # TypeScript types
```

**Stack:**
- TypeScript
- MCP SDK (@modelcontextprotocol/sdk)
- SQLite (better-sqlite3)
- Node.js 18+

---


### 1. Initialize Your Project

```
You: Initialize project "TaskFlow" with Next.js 14 and Supabase
```

Context Sync creates a project and starts tracking context.

### 2. Make Decisions

```
You: We'll use NextAuth for authentication because it 
     integrates better with Next.js
```

Claude saves: `Decision: NextAuth for auth - Better Next.js integration`

### 3. Context Follows You Everywhere

Open any new chat, and Claude automatically knows:
- Project name
- Tech stack
- Architecture decisions
- Recent conversations

**No manual "load context" needed. It just works.**

---

## 🎯 Use Cases

### Solo Developer
```
Monday: Start project with Claude
Tuesday: Continue in new chat - context preserved
Friday: Come back - Claude remembers everything
```

### Multiple Projects
```
Project A: E-commerce site (React + Stripe)
Project B: Blog engine (Astro + MDX)
Project C: Mobile app (React Native)

Switch between them - Claude knows which is active
```

### Decision Tracking
```
"Why did we choose Postgres over MongoDB?"
Claude: "3 weeks ago, you chose Postgres because..."
[Retrieves exact reasoning from history]
```

---

## 🛠️ MCP Tools

Context Sync provides these tools to Claude:

### `init_project`
Initialize or switch to a project
```json
{
  "name": "my-app",
  "architecture": "Next.js 14 + TypeScript + Supabase",
  "path": "/path/to/project"
}
```

### `get_project_context`
Get current project context (called automatically)
```json
{
  "project": "my-app",
  "techStack": ["Next.js", "TypeScript", "Supabase"],
  "recentDecisions": [...]
}
```

### `save_decision`
Save an important decision
```json
{
  "type": "library",
  "description": "Using Zustand for state management",
  "reasoning": "Simpler than Redux"
}
```

### `save_conversation`
Archive important conversation snippets
```json
{
  "content": "User prefers functional components",
  "role": "user"
}
```

---

---

## 🗂️ NEW: Workspace Features (v0.2.0)

**Read your actual codebase. No more copy-pasting.**

Context Sync now has IDE-like capabilities! Point Claude to your project folder and it can:
- 📂 Read any file in your project
- 🌳 Visualize your folder structure  
- 🔍 Scan and understand your codebase
- 🎯 Provide context-aware code assistance

### Quick Start

```
You: Set workspace to /Users/me/my-app
Claude: ✅ Workspace set! I can now read your files.

You: How does authentication work?
Claude: [reads src/lib/auth.ts]
Claude: You're using NextAuth with JWT. Here's how it works...
```

**No manual file sharing. Just natural conversation.**

### Workspace Tools

#### `set_workspace`
Open a project folder (like opening in VS Code)
```
You: Set workspace to C:\projects\my-app
```

#### `read_file`
Read any file using relative paths
```
You: Read src/components/Header.tsx
```

#### `get_project_structure`
See your file/folder tree
```
You: Show me the project structure
```
Returns:
```
📂 Project Structure:
├── 📋 package.json
├── 📝 README.md
├── 📁 src/
│   ├── 📁 app/
│   ├── 📁 components/
│   └── 📁 lib/
```

#### `scan_workspace`
Get intelligent project overview
```
You: Scan the workspace
```
Returns:
- File count by type
- Lines of code estimate
- Important files (configs, entry points, docs)
- Project structure

### Real-World Examples

**Example 1: Code Understanding**
```
You: Set workspace to /my/ecommerce-app
You: How do products get from database to UI?

Claude: [reads src/lib/db.ts, api/products/route.ts, ProductCard.tsx]
Claude: Here's the data flow:
1. Database query in db.ts
2. API route fetches products  
3. ProductCard displays them
[explains each step]
```

**Example 2: Debugging**
```
You: I'm getting a TypeScript error in Header component
Claude: [reads src/components/Header.tsx]
Claude: Found it! Line 12 - you're passing a string where 
a number is expected. Here's the fix...
```

**Example 3: Project Onboarding**
```
You: I just joined this project. What is it?
Claude: [scans workspace]
Claude: This is a Next.js 14 e-commerce app:
- Frontend: React + TypeScript + Tailwind
- Backend: Next.js API routes
- Database: PostgreSQL with Prisma
- Auth: NextAuth

Key files:
- src/app/page.tsx - Homepage
- src/lib/db.ts - Database config
- src/lib/auth.ts - Authentication
```

### Supported File Types

📘 TypeScript • ⚛️ React/TSX • 📜 JavaScript • 🐍 Python  
🦀 Rust • 🔷 Go • ☕ Java • 🎨 CSS • 🌐 HTML  
📋 JSON • 📝 Markdown • and 15+ more!

### Documentation

**Full guide:** See [WORKSPACE.md](WORKSPACE.md) for:
- Complete tool reference
- Advanced examples
- Troubleshooting
- Security best practices
- Tips & tricks

---

## 🎬 Demo

**[TODO: Add demo GIF]**

Watch Context Sync in action:
1. Start project in Chat 1
2. Close everything
3. Open NEW chat
4. Claude remembers everything 🤯

---

## 📁 Where's My Data?

All context is stored locally at:
- **Mac/Linux:** `~/.context-sync/data.db`
- **Windows:** `%USERPROFILE%\.context-sync\data.db`

**Your data never leaves your machine.**

---

## 🔧 Advanced Usage

### Multiple Projects

```bash
# Switch between projects
You: "Switch to my blog project"
Claude: [loads blog context]

You: "What projects do I have?"
Claude: Lists all your projects
```

### View Your Data

```bash
# Inspect the database
sqlite3 ~/.context-sync/data.db

sqlite> SELECT * FROM projects;
sqlite> SELECT * FROM decisions;
```

### Manual Configuration

If the setup script fails, manually edit your Claude config:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "context-sync": {
      "command": "node",
      "args": [
        "/absolute/path/to/context-sync/dist/index.js"
      ]
    }
  }
}
```

---

## 🐛 Troubleshooting

### Claude doesn't see the MCP server

1. Verify build succeeded: `ls dist/index.js`
2. Test server manually: `node dist/index.js`
3. Check Claude config path is correct
4. Restart Claude Desktop completely

### "No active project" error

Initialize a project first:
```
You: Initialize a project called "test"
```

### Server disconnected

Check Claude logs:
- **Mac:** `~/Library/Logs/Claude/`
- **Windows:** `%LOCALAPPDATA%\Claude\logs\`
- **Linux:** `~/.local/state/Claude/logs/`

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed help.

---

## 🗺️ Roadmap

### Current (v0.1.0)
- ✅ Cross-chat persistent memory
- ✅ Project context tracking
- ✅ Decision history
- ✅ Local storage

### Coming Soon (v0.2.0)
- 🔄 Automatic context capture (no manual saving)
- 🔍 Project auto-detection from filesystem
- 📊 Web dashboard to view/edit context

### Future (v0.3.0+)
- 🔀 Cursor IDE integration
- 💻 VS Code extension (GitHub Copilot support)
- 🔍 Semantic search across conversations
- 👥 Team collaboration & context sharing
- ☁️ Optional cloud sync

See [ROADMAP.md](ROADMAP.md) for full details.

---

## 🤝 Contributing

Contributions welcome! This is an open-source project and we'd love your help.

**Ways to contribute:**
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority areas:**
1. Auto-detection of projects from package.json
2. Cursor IDE integration
3. GitHub Copilot support
4. Smart context summarization

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Inspired by developers frustrated with AI memory loss
- Thanks to the MCP community for feedback and support

---

## ⭐ Show Your Support

If Context Sync saves you time and frustration, give it a star! ⭐

It helps others discover the project and motivates continued development.

---

## 📬 Contact & Community

- **Issues:** [GitHub Issues](https://github.com/Intina47/context-sync/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Intina47/context-sync/discussions)

---

## FAQ

### Where is my data stored?

`~/.context-sync/data.db` - it's a SQLite database on your machine.

### Does this work with ChatGPT?

Not yet. ChatGPT web doesn't support MCP. We'd need a browser extension.

### Can I use this with Cursor?

Not yet in this MVP. Cursor supports MCP, so it's planned for Phase 2.

### Is my code data sent anywhere?

No. Everything stays local on your machine.

### What if I have multiple projects?

Use `init_project` to switch between them. Only one project is "active" at a time.

---

## Why Context Sync?

### vs. Mem0 OpenMemory

- **Focused on coding projects**, not general memory
- Tracks architectural decisions explicitly
- Designed for developer workflows

### vs. Manual Copy-Paste

- Zero effort after setup
- Works automatically across tools
- Intelligent summarization

### vs. Claude Projects

- Works across multiple AI tools
- Not limited to Claude
- Local-first, you own your data

---

## 🚀 Get Started Now

```bash
git clone https://github.com/Intina47/context-sync.git
cd context-sync
node setup.js
```

**Stop repeating yourself. Give Claude the memory it deserves.**

---
<p align="center">
  <strong>Made with ❤️ by developers tired of explaining the same thing 10 times</strong>
</p>

<p align="center">
  <a href="#quick-start-5-minutes">Get Started</a> •
  <a href="#-demo">Demo</a> •
  <a href="#-roadmap">Roadmap</a> •
  <a href="#-contributing">Contributing</a>
</p>
