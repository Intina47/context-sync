# 🚀 Workspace Quick Reference

> **TL;DR**: Point Claude to your project folder. It can now read your code.

## 30-Second Start

```bash
# 1. Open Claude
# 2. Say this:

You: Set workspace to /path/to/your/project

# Done! Claude can now read your files.
```

---

## The 4 Commands You Need

### 1. 📂 Open Workspace
```
You: Set workspace to /Users/me/my-app
```
**What it does:** Opens your project folder

### 2. 📄 Read Files
```
You: Read src/app.ts
You: Show me the config file
You: What's in package.json?
```
**What it does:** Reads specific files

### 3. 🌳 See Structure
```
You: Show project structure
You: What folders do I have?
```
**What it does:** Visual tree of your project

### 4. 🔍 Scan Everything
```
You: Scan workspace
You: Give me a project overview
```
**What it does:** Intelligent summary of your codebase

---

## Common Workflows

### 🆕 New Project
```
You: Set workspace to /my/new-project
You: Scan workspace
You: Read README.md
```
**Result:** Full understanding of the project

### 🐛 Debugging
```
You: Set workspace to /my/app
You: I have a bug in the auth code
Claude: [reads src/lib/auth.ts]
Claude: Found the issue...
```
**Result:** Claude sees your actual code

### 📝 Code Review
```
You: Set workspace to /my/app
You: Review the database module
Claude: [reads src/lib/db.ts]
Claude: Here are my suggestions...
```
**Result:** Informed code review

### 🔄 Refactoring
```
You: Set workspace to /my/app
You: Show me the Header component
Claude: [reads src/components/Header.tsx]
You: How can I improve it?
Claude: Here are 3 improvements...
```
**Result:** Context-aware refactoring

---

## Path Examples

### ✅ Correct Paths

**macOS/Linux:**
```
/Users/yourname/projects/my-app
/home/yourname/code/project
~/projects/my-app
```

**Windows:**
```
C:\Users\yourname\projects\my-app
D:\code\my-project
```

### ❌ Common Mistakes

```
❌ my-app (not absolute)
❌ ~/Desktop/my app (spaces need quotes or escaping)
❌ C:/Users/me/project (use backslash on Windows)
```

---

## File Paths

Always use **relative paths** from workspace root:

```
✅ src/app.ts
✅ components/Header.tsx
✅ package.json
✅ src/lib/auth/index.ts

❌ /Users/me/project/src/app.ts (absolute)
❌ ./src/app.ts (no ./ prefix needed)
```

---

## Natural Language

You don't need exact commands! Claude understands:

```
✅ "Open my project at /path/to/app"
✅ "What's in the Header component?"
✅ "Show me the folder structure"
✅ "Read the config"
✅ "Give me a project overview"
```

---

## What Gets Ignored?

Claude automatically filters out:
- `node_modules/`
- `.git/`
- `dist/`, `build/`, `.next/`
- `.cache/`, `coverage/`
- Hidden files (`.env`, `.gitignore`, etc.)

**Why?** These clutter the view and aren't usually relevant.

**Need to read them?** Ask directly:
```
You: Read .env.example
```

---

## File Icons Guide

| Icon | Type |
|------|------|
| 📘 | TypeScript (`.ts`) |
| ⚛️ | React/TSX (`.tsx`, `.jsx`) |
| 📜 | JavaScript (`.js`) |
| 🐍 | Python (`.py`) |
| 🦀 | Rust (`.rs`) |
| 🔷 | Go (`.go`) |
| 📋 | JSON (`.json`) |
| 📝 | Markdown (`.md`) |
| 🎨 | CSS (`.css`, `.scss`) |
| 📄 | Generic file |
| 📁 | Folder |

---

## Pro Tips

### 💡 Tip 1: Combine with Projects
```
You: Set workspace to /my/app
You: Initialize project "my-app" with Next.js
```
**Result:** Workspace + Context Sync = Perfect memory

### 💡 Tip 2: Deep Dive
```
You: Show structure with depth 5
```
**Result:** See deeper folder levels

### 💡 Tip 3: Multiple Files
```
You: Compare User and Product models
Claude: [reads models/User.ts and models/Product.ts]
Claude: Here are the differences...
```
**Result:** Multi-file analysis

### 💡 Tip 4: Documentation First
```
You: Set workspace to /new/project
You: Read README.md
You: Scan workspace
```
**Result:** Best way to understand a new codebase

---

## Troubleshooting

### ❌ "No workspace set"
**Fix:** Run `set_workspace` first

### ❌ "File not found: src/app.ts"
**Fix:** Check the path is relative and correct

### ❌ Files not showing in structure
**Fix:** They might be filtered (node_modules, etc.)

### ❌ Workspace on wrong folder
**Fix:** Just set it again to the correct path

---

## Cheat Sheet

| You Want To... | Say This |
|----------------|----------|
| Open project | `Set workspace to /path` |
| Read a file | `Read src/app.ts` |
| See structure | `Show structure` |
| Overview | `Scan workspace` |
| Find file | `Where is the auth code?` |
| Multiple files | `Show me all models` |
| Deeper structure | `Structure depth 5` |
| Switch projects | `Set workspace to /other/path` |

---

## Next Steps

📖 **Full Documentation:** [WORKSPACE.md](WORKSPACE.md)  
🐛 **Issues?** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)  
💬 **Questions?** [GitHub Discussions](https://github.com/Intina47/context-sync/discussions)

---

## Remember

1. **Set workspace first** - That's the key step
2. **Use relative paths** - No `/Users/...` stuff
3. **Natural language works** - Just ask normally
4. **Combine with projects** - Double the power

**That's it! Start exploring your code with Claude.**

---

<p align="center">
  <strong>Made by developers, for developers</strong>
</p>