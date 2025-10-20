# 📦 Migration Guide: v0.1.0 → v0.2.0

> **TL;DR:** No breaking changes! Just new features. Update and enjoy workspace support.

---

## ✅ Quick Update

### For Existing Users

```bash
cd context-sync
git pull origin main
npm install
npm run build
```

**Restart Claude Desktop** and you're done! 🎉

---

## 🎉 What's New?

### Before (v0.1.0)
```
You: "I'm building a Next.js app with Supabase"
Claude: "Great! How can I help?"
```

### After (v0.2.0)
```
You: "Set workspace to /my/nextjs-app"
Claude: [reads package.json, detects Next.js + Supabase]
Claude: "I can see you're using Next.js 14 and Supabase. 
I can now read your files. What would you like to work on?"
```

**The difference:** Claude can now **see your actual code**.

---

## 🔄 Compatibility

### ✅ Fully Compatible

All your existing features work exactly the same:
- ✅ `init_project` - Still works
- ✅ `get_project_context` - Still works
- ✅ `save_decision` - Still works
- ✅ `save_conversation` - Still works
- ✅ Existing projects - Still accessible
- ✅ Decision history - Preserved
- ✅ Database - No changes needed

### 🆕 New Features (Opt-In)

Four new tools available (optional to use):
- `set_workspace` - Open project folder
- `read_file` - Read files
- `get_project_structure` - See file tree
- `scan_workspace` - Project overview

**You choose when to use them.**

---

## 📋 Migration Checklist

### Step 1: Update Code ✅
```bash
cd context-sync
git pull
npm install
npm run build
```

### Step 2: Restart Claude ✅
- **Mac:** Cmd+Q, reopen
- **Windows:** Right-click tray → Exit, reopen
- **Linux:** Close and reopen

### Step 3: Test (Optional) ✅
```
Open Claude, say:
"Set workspace to /path/to/any/project"
"Scan workspace"
```

If you see project structure → Success! 🎉

### Step 4: Update Workflows (Optional) ✅

**Old workflow:**
```
1. Init project
2. Copy-paste code into chat
3. Discuss with Claude
```

**New workflow:**
```
1. Set workspace
2. Claude reads code directly
3. Discuss naturally
```

---

## 🆕 New Capabilities

### 1. Direct File Access

**Before:**
```
You: "Here's my auth code: [paste 200 lines]"
Claude: "Thanks, let me review..."
```

**After:**
```
You: "Read src/lib/auth.ts"
Claude: [reads file automatically]
Claude: "I see you're using..."
```

### 2. Project Understanding

**Before:**
```
You: "I'm using Next.js, React, TypeScript, Tailwind, 
Supabase, Prisma, NextAuth..."
Claude: "Got it, stored in context"
```

**After:**
```
You: "Set workspace to /my/project"
Claude: [scans package.json]
Claude: "Detected: Next.js, React, TypeScript, Tailwind, 
Supabase, Prisma, NextAuth"
```

### 3. Visual Structure

**Before:**
```
You: "My project has src/app, src/components, src/lib..."
Claude: "Noted"
```

**After:**
```
You: "Show structure"
Claude:
📂 my-project
├── 📁 src/
│   ├── 📁 app/
│   ├── 📁 components/
│   └── 📁 lib/
```

---

## 💡 Updated Workflows

### Workflow 1: Starting New Project

**v0.1.0 way (still works):**
```
You: Init project "my-app" with Next.js
You: We're using Supabase
You: We decided to use NextAuth
```

**v0.2.0 enhanced way:**
```
You: Set workspace to /path/to/my-app
[Auto-detects Next.js, Supabase from package.json]
You: We decided to use NextAuth
[Saves decision AND can read auth code]
```

### Workflow 2: Continuing Work

**v0.1.0 way (still works):**
```
[New chat]
You: What's the current project?
Claude: [loads context from DB]
```

**v0.2.0 enhanced way:**
```
[New chat]
You: Set workspace to /my/app
Claude: [loads context + reads files]
Claude: "You're working on my-app. Last time we discussed auth."
```

### Workflow 3: Code Reviews

**v0.1.0 way:**
```
You: [paste code]
You: "Review this"
```

**v0.2.0 way:**
```
You: Set workspace to /my/app
You: "Review src/lib/db.ts"
[Claude reads and reviews]
```

---

## 🗄️ Database Changes

### Schema Updates

**Good news:** No database migration needed!

The database schema is **fully backward compatible**. New workspace features don't require schema changes - they use the file system directly.

Your existing:
- Projects ✅
- Decisions ✅
- Conversations ✅
- Context history ✅

All preserved exactly as they were.

---

## 🔧 Configuration Changes

### Claude Desktop Config

**No changes needed!** Your existing config works as-is:

```json
{
  "mcpServers": {
    "context-sync": {
      "command": "node",
      "args": ["/path/to/context-sync/dist/index.js"]
    }
  }
}
```

The new workspace features are automatically available through MCP.

---

## 🎯 Recommended Usage Patterns

### Pattern 1: Workspace + Project

**Best for:** Long-term projects

```
You: Set workspace to /my/app
You: Initialize project "my-app" 
[Workspace provides file access]
[Project tracks decisions/context]
```

**Benefits:**
- File access from workspace
- Context persistence from project
- Best of both worlds

### Pattern 2: Workspace Only

**Best for:** Quick explorations

```
You: Set workspace to /temp/experiment
[Explore code]
[No need to init project]
```

**Benefits:**
- Fast setup
- No context overhead
- Perfect for one-off tasks

### Pattern 3: Project Only

**Best for:** Planning/architecture discussions

```
You: Init project "new-idea"
[Discuss architecture]
[No code yet]
```

**Benefits:**
- Track decisions before coding
- No workspace needed yet
- Good for early planning

---

## 🐛 Troubleshooting

### Issue 1: Workspace tools not appearing

**Symptoms:** Claude doesn't recognize `set_workspace`

**Fix:**
```bash
# Rebuild
cd context-sync
npm run build

# Restart Claude completely
```

### Issue 2: "No workspace set" errors

**Symptoms:** `read_file` fails

**Fix:** Set workspace first:
```
You: Set workspace to /your/project
```

### Issue 3: Old projects not loading

**Symptoms:** Previous projects missing

**Fix:** They're still there! Database unchanged:
```
You: Get project context
[Shows all previous projects]
```

### Issue 4: Performance slower

**Symptoms:** Responses take longer

**Reason:** Initial file scanning

**Fix:** Subsequent reads are cached - much faster

---

## 📚 Updated Documentation

### New Files Created
- ✅ `WORKSPACE.md` - Complete workspace guide
- ✅ `WORKSPACE_QUICKREF.md` - Quick reference
- ✅ `MIGRATION_v0.2.0.md` - This guide

### Updated Files
- ✅ `README.md` - Added workspace section
- ✅ `CHANGELOG.md` - Documented v0.2.0
- ✅ `ROADMAP.md` - Updated completion status

### Read First
1. [WORKSPACE_QUICKREF.md](WORKSPACE_QUICKREF.md) - 2 minute read
2. [WORKSPACE.md](WORKSPACE.md) - Full guide
3. [CHANGELOG.md](CHANGELOG.md) - What changed

---

## 🎓 Learning Path

### Week 1: Basic Usage
- Day 1-2: Try `set_workspace` on 1-2 projects
- Day 3-4: Practice `read_file` on different files
- Day 5-7: Experiment with `scan_workspace`

### Week 2: Integration
- Combine workspace with existing projects
- Use workspace + decisions together
- Explore multi-file reading

### Week 3: Mastery
- Optimize your workflow
- Learn shortcuts and patterns
- Share your experience!

---

## 💬 Feedback

### What We Want to Know

1. **What works?** - Tell us your wins
2. **What's confusing?** - Help us improve docs
3. **What's missing?** - Shape v0.3.0
4. **What broke?** - Help us fix bugs

### Where to Share

- 🐛 **Bugs:** [GitHub Issues](https://github.com/Intina47/context-sync/issues)
- 💡 **Ideas:** [GitHub Discussions](https://github.com/Intina47/context-sync/discussions)
- ⭐ **Love it?** Star the repo!
- 📣 **Share:** Tweet about it!

---

## ✨ What's Next?

### Coming in v0.3.0 (Q1 2026)

Based on v0.2.0 foundation:
- **File Writing** - Let Claude create/edit files
- **File Search** - Find files by content
- **Git Integration** - See changes and diffs
- **Symbol Search** - Jump to functions/classes

See [ROADMAP.md](ROADMAP.md) for full details.

---

## 📊 Quick Comparison

| Feature | v0.1.0 | v0.2.0 |
|---------|--------|--------|
| Cross-chat memory | ✅ | ✅ |
| Project tracking | ✅ | ✅ |
| Decision history | ✅ | ✅ |
| **File reading** | ❌ | ✅ |
| **Structure view** | ❌ | ✅ |
| **Workspace scan** | ❌ | ✅ |
| **20+ languages** | ❌ | ✅ |
| Local storage | ✅ | ✅ |
| No breaking changes | - | ✅ |

---

## 🎉 Welcome to v0.2.0!

**You now have:**
- ✅ Everything from v0.1.0
- ✅ IDE-like file access
- ✅ Visual project structure
- ✅ Intelligent scanning
- ✅ No breaking changes
- ✅ Same simple setup

**Start exploring:**
```
You: Set workspace to /your/favorite/project
You: Scan workspace
You: Read your/favorite/file
```

**Happy coding! 🚀**

---

<p align="center">
  <strong>Questions? Check the docs or open an issue!</strong>
</p>

<p align="center">
  <a href="WORKSPACE_QUICKREF.md">Quick Ref</a> •
  <a href="WORKSPACE.md">Full Guide</a> •
  <a href="TROUBLESHOOTING.md">Help</a> •
  <a href="https://github.com/Intina47/context-sync/discussions">Discussions</a>
</p>