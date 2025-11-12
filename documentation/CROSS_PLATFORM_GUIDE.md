# Cross-Platform AI Integration Guide

## 🎯 Overview

Context Sync now supports **seamless context sharing** between Claude Desktop and Cursor IDE. Work on your project in Claude, switch to Cursor, and pick up exactly where you left off!

## 🚀 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SESSIONS (In-Memory, Per-Instance)                   │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐ │
│  │  Claude Desktop      │  │  Cursor              │  │ vscode/copilot │ │
│  │  MCP Server Instance │  │  MCP Server Instance │  │ MCP Server Inst│ │
│  │                      │  │                      │  │                │ │
│  │  currentProjectId:   │  │  currentProjectId:   │  │ currentProjectId││
│  │  "context-sync-123"  │  │  "hostscan-456"      │  │ "context-sync-1│ │
│  │                      │  │                      │  │                │ │
│  │  workspace:          │  │  workspace:          │  │ workspace:     │ │
│  │  /proj/context-sync  │  │  /proj/hostscan      │  │ /proj/context-s│ │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬───────┘ │
└─────────────┼─────────────────────────┼──────────-────────────┼─────────┘
              │                         │                       │
              │        All read/write to shared DB              │
              └──────────────────┬───────────────┬──────────────┘
                                 ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite) - SHARED                           │
│                                                                          │
│  projects table (NO is_current column):                                 │
│  ┌──────────────────────────────────────────────┐                      │
│  │ id: "context-sync-123"                       │                      │
│  │ name: "context-sync"                         │                      │
│  │ path: "/projects/context-sync"               │                      │
│  │ tech_stack: ["TypeScript", "React"]          │                      │
│  └──────────────────────────────────────────────┘                      │
│  ┌──────────────────────────────────────────────┐                      │
│  │ id: "hostscan-456"                           │                      │
│  │ name: "hostscan"                             │                      │
│  │ path: "/projects/hostscan"                   │                      │
│  │ tech_stack: ["Next.js", "Supabase"]          │                      │
│  └──────────────────────────────────────────────┘                      │
│                                                                          │
│  decisions table:                                                       │
│  ┌──────────────────────────────────────────────┐                      │
│  │ project_id: "context-sync-123"               │                      │
│  │ description: "Use TypeScript for type safety"│                      │
│  └──────────────────────────────────────────────┘                      │
│  ┌──────────────────────────────────────────────┐                      │
│  │ project_id: "hostscan-456"                   │                      │
│  │ description: "Use Supabase for backend"      │                      │
│  └──────────────────────────────────────────────┘                      │
│                                                                          │
│  todos table:                                                           │
│  ┌──────────────────────────────────────────────┐                      │
│  │ project_id: "context-sync-123"               │                      │
│  │ title: "Fix workspace linking bug"           │                      │
│  └──────────────────────────────────────────────┘                      │
│  ┌──────────────────────────────────────────────┐                      │
│  │ project_id: "hostscan-456"                   │                      │
│  │ title: "Add QR code scanner"                 │                      │
│  └──────────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Both AIs connect to the same Context Sync server**
- **Same SQLite database** stores all context
- **Real-time sync** - changes made in one platform are immediately available in the other
- **Platform-aware** - knows which AI you're using and tracks conversations separately

## 📋 Setup Instructions

### Step 1: Configure Claude Desktop (Already Done ✅)

Claude Desktop should already have Context Sync configured at:
- **Windows**: `%AppData%\Roaming\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Configuration:
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"]
    }
  }
}
```

### Step 2: Configure Cursor IDE

#### Option A: Using the Tool (Recommended)

In Claude, run:
```
Use the setup_cursor tool
```

This will give you the exact path and configuration.

#### Option B: Manual Configuration

1. **Create/Edit Cursor Config**:
   - **Location**: `~/.cursor/mcp.json`
   - Create the file if it doesn't exist

2. **Add Configuration**:
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["-y", "@context-sync/server"]
    }
  }
}
```

3. **Restart Cursor** or refresh MCP servers in settings

### Step 3: Verify Setup

Check platform status:
```
get_platform_status tool
```

You should see:
```
✅ Claude Desktop
✅ Cursor
❌ GitHub Copilot (coming soon)
```

## 💡 Usage Examples

### Example 1: Start in Claude, Continue in Cursor

**In Claude Desktop:**
```
1. Create project: "init_project" with name "my-app"
2. Make decisions: "save_decision" - chose React for frontend
3. Have conversations: "Let's build the authentication system"
```

**Switch to Cursor:**
```
1. Open your project in Cursor
2. Cursor AI now has FULL context:
   - Knows the project is "my-app"
   - Knows you chose React
   - Sees the authentication discussion
   - Can continue exactly where you left off
```

### Example 2: Explicit Handoff

When switching platforms, you can explicitly trigger a handoff:

```typescript
// In Claude
switch_platform({
  fromPlatform: "claude",
  toPlatform: "cursor"
})

// Response:
📱 Platform Handoff: claude → cursor

📁 Project: my-app
🏗️  Architecture: Monorepo
⚙️  Tech Stack: React, TypeScript, Node.js

📋 Recent Decisions (3):
1. [architecture] Using monorepo structure with Turborepo
2. [library] React for frontend, Express for backend
3. [pattern] Implementing clean architecture

💬 Last conversation on claude:
"Let's implement the authentication system using JWT tokens..."

✅ Context synced and ready on cursor!
```

### Example 3: Platform-Specific Context

Get context for a specific platform:

```typescript
// See what happened on Cursor
get_platform_context({ platform: "cursor" })

// Response shows:
📱 Current Platform: cursor

📁 Project: my-app
⚙️  Tech Stack: React, TypeScript

📋 Recent Decisions (shared across all platforms):
1. [architecture] Using monorepo structure
2. [library] React for frontend

💬 Your conversations on cursor (5 total):
1. [10/22 14:30] user: "How do I implement JWT auth?"
2. [10/22 14:35] assistant: "Here's the implementation..."
3. [10/22 14:40] user: "Let me test this..."

🔄 Activity on other platforms:
  • claude: 8 conversations

💡 All context is automatically synced!
```

## 🔧 Advanced Features

### 1. Automatic Platform Detection

Context Sync automatically detects which platform you're using based on environment variables:
- `CURSOR_IDE` or `CURSOR_VERSION` → Cursor
- `GITHUB_COPILOT_TOKEN` → GitHub Copilot
- Default → Claude

### 2. Cross-Platform Conversation Tracking

Every conversation is tagged with the platform:
```typescript
storage.addConversation({
  projectId: 'project-123',
  tool: 'cursor',  // or 'claude'
  role: 'user',
  content: 'How do I implement this feature?'
});
```

### 3. Shared Decisions, Separate Conversations

- **Decisions** (architecture, tech choices) are shared across ALL platforms
- **Conversations** are tracked per-platform but visible to all
- This gives you platform-specific history while maintaining global context

## 🎨 User Workflow

### Typical Multi-Platform Workflow

1. **Planning Phase (Claude Desktop)**
   ```
   - Brainstorm architecture
   - Make key decisions
   - Design API contracts
   - Plan folder structure
   ```

2. **Coding Phase (Cursor IDE)**
   ```
   - Open project in Cursor
   - AI knows all decisions from Claude
   - Write code with full context
   - Ask implementation questions
   ```

3. **Review Phase (Claude Desktop)**
   ```
   - Return to Claude
   - Review what was built in Cursor
   - Discuss improvements
   - Make new decisions
   ```

4. **Iterate** 🔄

## 🛠️ New MCP Tools

### Platform Management Tools

#### `switch_platform`
Switch between AI platforms with full context handoff.

```typescript
{
  fromPlatform: 'claude' | 'cursor' | 'copilot' | 'other',
  toPlatform: 'claude' | 'cursor' | 'copilot' | 'other'
}
```

**Use Cases:**
- Explicit handoff when changing platforms
- Get summary of what happened on previous platform
- Log the platform switch for context

#### `get_platform_status`
Check which platforms are configured with Context Sync.

```typescript
// No parameters
```

**Returns:**
- ✅/❌ for each platform
- Current active platform
- Configuration instructions for unconfigured platforms

#### `get_platform_context`
Get context specific to a platform.

```typescript
{
  platform?: 'claude' | 'cursor' | 'copilot' | 'other'  // Optional, defaults to current
}
```

**Returns:**
- Platform-specific conversations
- Shared decisions
- Activity on other platforms

#### `setup_cursor`
Get setup instructions for Cursor IDE.

```typescript
// No parameters
```

**Returns:**
- Configuration file path
- Exact JSON to add
- Step-by-step instructions

## 📊 Data Model

### Project Context (Shared)
```typescript
interface ProjectContext {
  id: string;
  name: string;
  path?: string;
  architecture?: string;
  techStack: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Decision (Shared Across Platforms)
```typescript
interface Decision {
  id: string;
  projectId: string;
  type: 'architecture' | 'library' | 'pattern' | 'configuration' | 'other';
  description: string;
  reasoning?: string;
  timestamp: Date;
}
```

### Conversation (Platform-Specific)
```typescript
interface Conversation {
  id: string;
  projectId: string;
  tool: 'claude' | 'cursor' | 'copilot' | 'other';  // ← Platform tag
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    handoff?: boolean;
    fromPlatform?: string;
    toPlatform?: string;
  };
}
```

## 🔒 Privacy & Data Location

- **All data is stored locally** on your machine
- **SQLite database** location:
  - Windows: `%AppData%\context-sync\context.db`
  - macOS/Linux: `~/.context-sync/context.db`
- **No cloud sync** - data stays on your device
- **Same database** accessed by both Claude and Cursor

## 🐛 Troubleshooting

### Issue: Cursor not showing context

**Solution:**
1. Check if MCP is configured: `~/.cursor/mcp.json`
2. Verify the config matches the setup instructions
3. Restart Cursor completely
4. Check MCP server logs in Cursor settings

### Issue: Context not syncing

**Solution:**
1. Both platforms must point to the same MCP server
2. Check that you're using the same project (same project ID)
3. Use `get_platform_status` to verify configuration

### Issue: Old context showing

**Solution:**
1. Context Sync uses the same database
2. Make sure you're in the right project: `get_project_context`
3. Switch projects if needed: `detect_project` with correct path

## 🚀 Future Enhancements

### Coming Soon:
- ✅ Claude Desktop support (Done)
- ✅ Cursor IDE support (Done)
- 🔄 GitHub Copilot support (Planned)
- 🔄 VS Code support (Planned)
- 🔄 JetBrains IDEs support (Planned)

### Potential Features:
- Cloud sync option for teams
- Conflict resolution for simultaneous edits
- Platform-specific preferences
- Conversation export/import
- Integration with more IDEs

## 📝 Best Practices

### 1. Use Explicit Handoffs
When switching platforms, call `switch_platform` to get a summary:
```typescript
switch_platform({ fromPlatform: 'claude', toPlatform: 'cursor' })
```

### 2. Make Decisions Explicit
Use `save_decision` for important choices:
```typescript
save_decision({
  type: 'architecture',
  description: 'Using GraphQL for API layer',
  reasoning: 'Provides better type safety and flexibility'
})
```

### 3. Check Context Before Starting
Use `get_platform_context` to see what happened:
```typescript
get_platform_context({ platform: 'cursor' })
```

### 4. Keep Projects Organized
- One project per codebase
- Use descriptive project names
- Set project path for automatic detection

## 🎯 Summary

Context Sync enables seamless collaboration between different AI platforms:

✅ **Single source of truth** - One database, multiple interfaces
✅ **Zero configuration** - Works out of the box once set up
✅ **Platform-aware** - Knows what happened where
✅ **Real-time sync** - No manual export/import needed
✅ **Privacy-focused** - All data stays local

**Ready to start?** Configure Cursor with `setup_cursor` and enjoy seamless multi-platform AI development! 🚀
