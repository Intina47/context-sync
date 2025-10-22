# Context Sync 🧠

> **The MCP server that gives AI assistants perfect memory across all your projects.**

Context Sync is an MCP server that provides persistent memory, advanced code analysis, and cross-platform AI collaboration. Works with Claude Desktop, Cursor IDE, and more.

<p align="center">
  <img src="https://img.shields.io/badge/MCP-Compatible-blue" alt="MCP Compatible">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
  <img alt="NPM Version" src="https://img.shields.io/npm/v/@context-sync/server" alt="npm">
  <img alt="Version" src="https://img.shields.io/badge/version-0.4.0-green" alt="Version">
</p>

---

## 🚀 Quick Start

```bash
npm install -g @context-sync/server
```

**That's it!** Restart Claude Desktop and you're ready to go.

---

## ✨ What Context Sync Does

### 🧠 **Persistent Memory**
- **Cross-Chat Memory** - Claude remembers everything across all chats
- **Project Context** - Tracks architecture, tech stack, and decisions
- **Decision History** - Never forget why you made choices
- **Local-First** - All data stays on your machine

### 📂 **Workspace Integration** 
- **File Reading** - Claude can read any file in your project
- **Code Understanding** - Analyze your codebase structure
- **Smart Search** - Find files, content, and symbols instantly
- **Git Integration** - Track changes and suggest commits

### 🔍 **Advanced Code Analysis** *(v0.4.0)*
- **Dependency Analysis** - Understand imports, exports, and circular dependencies
- **Call Graph Analysis** - Trace function calls and execution paths  
- **Type Analysis** - Find type definitions and track usage
- **Impact Analysis** - See what breaks when you change code

### 🔀 **Cross-Platform AI Sync** *(v0.4.0)*
- **Platform Detection** - Works with Claude Desktop, Cursor IDE, GitHub Copilot
- **Context Handoff** - Seamlessly switch between AI platforms
- **Unified Memory** - All AIs share the same project context
- **Easy Setup** - One-click integration with Cursor IDE

---

## 🎯 Use Cases

### **Solo Developer**
```
Monday: Start project with Claude
Tuesday: Continue in new chat - context preserved  
Friday: Come back - Claude remembers everything
```

### **Cross-Platform Development**
```
Start in Claude Desktop → Switch to Cursor IDE → Continue seamlessly
Both AIs have full context of your project
```

### **Code Understanding**
```
"How does authentication work?" 
→ Claude traces the auth flow across your codebase
→ Shows dependencies, call graphs, and type relationships
```

### **Impact Analysis**
```
"What breaks if I change this function?"
→ Claude shows all callers and dependencies
→ Predicts impact before you make changes
```

---

## 🛠️ MCP Tools

Context Sync provides **30+ MCP tools** organized into categories:

### **Core Memory Tools**
- `init_project` - Initialize or switch projects
- `get_project_context` - Get current project context
- `save_decision` - Save architectural decisions
- `save_conversation` - Archive important discussions

### **Workspace Tools**
- `set_workspace` - Open project folders
- `read_file` - Read any file in your project
- `get_project_structure` - Visualize folder structure
- `scan_workspace` - Intelligent project overview

### **File Operations**
- `create_file` - Create new files with preview
- `modify_file` - Edit files with approval workflow
- `delete_file` - Remove files with confirmation
- `undo_file_change` - Rollback changes

### **Search & Discovery**
- `search_files` - Find files by name or pattern
- `search_content` - Grep-like search across codebase
- `find_symbol` - Jump to functions, classes, variables

### **Git Integration**
- `git_status` - Check repository status
- `git_diff` - View differences between commits
- `git_branch_info` - Get branch information
- `suggest_commit_message` - Generate commit messages

### **Advanced Analysis** *(v0.4.0)*
- `analyze_dependencies` - Get complete dependency info
- `analyze_call_graph` - Trace function relationships
- `find_type_definition` - Find type definitions
- `trace_execution_path` - Follow code execution paths

### **Cross-Platform Sync** *(v0.4.0)*
- `switch_platform` - Switch between AI platforms
- `get_platform_status` - Check platform configuration
- `setup_cursor` - Get Cursor IDE setup instructions
- `get_platform_context` - Get platform-specific context

---

## 📖 How It Works

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Claude    │    │   Cursor    │    │  Copilot    │
│  Desktop    │    │     IDE     │    │  (coming)   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌─────────────────┐
                  │  Context Sync   │
                  │   MCP Server    │
                  └─────────────────┘
                           │
                  ┌─────────────────┐
                  │   SQLite DB     │
                  │ ~/.context-sync │
                  └─────────────────┘
```

**All your context is stored locally** - never leaves your machine.

---

## 🚀 Installation

### **Option 1: NPM (Recommended)**
```bash
npm install -g @context-sync/server
```

### **Option 2: Source Code**
```bash
git clone https://github.com/Intina47/context-sync.git
cd context-sync
node setup.js
```

### **Restart Claude Desktop**
- **Mac:** `Cmd+Q` then reopen
- **Windows:** Right-click tray icon → Exit, then reopen  
- **Linux:** Close and reopen

---

## 🎬 Demo

### **Cross-Chat Memory**
```
Chat 1:
You: "Initialize project 'TaskFlow' with Next.js and Supabase"
Claude: "Project initialized and saved to context"

Chat 2 (NEW):
You: "What project am I working on?"
Claude: "You're working on TaskFlow (Next.js + Supabase). 
Want to continue with authentication setup?"
```

### **Code Analysis**
```
You: "Analyze dependencies for src/lib/auth.ts"
Claude: [Shows imports, exports, circular deps, and impact analysis]

You: "What calls the authenticate function?"
Claude: [Traces call graph and shows all callers]
```

### **Cross-Platform Sync**
```
Claude Desktop: "I'll switch you to Cursor IDE"
Cursor IDE: "Welcome back! I can see you were working on 
the authentication flow. Ready to continue?"
```

---

## 📁 Data Storage

All context is stored locally at:
- **Mac/Linux:** `~/.context-sync/data.db`
- **Windows:** `%USERPROFILE%\.context-sync\data.db`

**Your data never leaves your machine.**

---

## 🔧 Advanced Usage

### **Multiple Projects**
```bash
You: "Switch to my blog project"
Claude: [loads blog context]

You: "What projects do I have?"
Claude: [Lists all projects with descriptions]
```

### **Cross-Platform Workflow**
```bash
# Start in Claude Desktop
You: "Initialize project 'my-app'"
Claude: "Project created and saved"

# Switch to Cursor IDE  
You: "Switch to Cursor"
Claude: "Context handed off to Cursor IDE"

# Cursor IDE automatically has full context
```

### **Code Analysis Workflow**
```bash
You: "Set workspace to /my/project"
You: "Analyze dependencies for src/components/Header.tsx"
Claude: [Shows complete dependency graph]

You: "What breaks if I change the Header component?"
Claude: [Shows all callers and impact analysis]
```

---

## 🐛 Troubleshooting

### **Claude doesn't see the MCP server**
1. Verify installation: `context-sync --version`
2. Check Claude config: `~/.config/Claude/claude_desktop_config.json`
3. Restart Claude Desktop completely

### **"No active project" error**
```bash
You: "Initialize a project called 'test'"
```

### **Cross-platform sync not working**
```bash
You: "Check platform status"
Claude: [Shows configuration status and setup instructions]
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed help.

---

## 🗺️ Roadmap

### **✅ v0.4.0 - Advanced Analysis & Cross-Platform Sync**
- 🔍 Dependency analysis and call graph tracing
- 🔀 Cross-platform AI collaboration
- 🏷️ Type analysis and definition lookup
- 📊 Impact analysis and execution tracing

### **🔄 v0.5.0 - AI-Powered Features**
- 🤖 Automatic context capture
- 🧠 Semantic code understanding
- 📊 Analytics and insights
- 🎓 Learning and suggestions

### **🔮 v0.6.0 - Team Collaboration**
- 👥 Team context sharing
- ☁️ Optional cloud sync
- 🔐 Enterprise features
- 📈 Advanced analytics

See [ROADMAP.md](ROADMAP.md) for full details.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority areas:**
- 🎨 UI/UX improvements
- 🔌 Additional IDE integrations  
- 📝 Documentation improvements
- 🧪 Testing and QA

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

---

## 📬 Contact & Community

- **Issues:** [GitHub Issues](https://github.com/Intina47/context-sync/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Intina47/context-sync/discussions)

---

<p align="center">
  <strong>Made with ❤️ by developers tired of explaining the same thing 10 times</strong>
</p>

<p align="center">
  <a href="#-quick-start">Get Started</a> •
  <a href="#-demo">Demo</a> •
  <a href="#-roadmap">Roadmap</a> •
  <a href="#-contributing">Contributing</a>
</p>