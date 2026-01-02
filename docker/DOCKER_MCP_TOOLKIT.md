# Using Context Sync with Docker MCP Toolkit

This guide explains how to use Context Sync MCP server with the Docker MCP Toolkit for dynamic installation and automatic setup with AI agents.

## Overview

The Docker MCP Toolkit enables:
- **Dynamic Installation**: Install Context Sync directly to your AI agents (Claude Desktop, VS Code) via Docker Desktop
- **Automatic Setup**: Simply tell your AI agent to "connect to context sync" and Docker handles everything
- **Zero Configuration**: No manual setup, dependency management, or configuration files needed

## Quick Start with Docker MCP Toolkit

### 1. Install Docker Desktop with MCP Toolkit

1. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Ensure the MCP Toolkit feature is enabled (Beta feature in Docker Desktop)

### 2. Add Context Sync from the Catalog

**Via Docker Desktop UI:**

1. Open Docker Desktop
2. Navigate to **MCP Toolkit** → **Catalog**
3. Search for "Context Sync"
4. Click **Add** to install Context Sync
5. Configure the server:
   - Set the database path (default: `/data/context-sync.db`)
   - Optionally mount your workspace directory

**Via CLI:**

```bash
# Enable Context Sync MCP server
docker mcp server enable context-sync

# Configure workspace volume (optional)
docker mcp server configure context-sync --volume workspace=/path/to/your/workspace
```

### 3. Connect to Your AI Agent

**Claude Desktop:**

1. Open Claude Desktop
2. In a new conversation, say: "Connect to Context Sync"
3. Claude will automatically connect via the Docker MCP Toolkit gateway
4. Start using Context Sync tools!

**VS Code with Copilot:**

1. Open VS Code
2. Ensure GitHub Copilot is installed
3. Connect to Docker MCP Toolkit gateway
4. Context Sync tools will be available in Copilot

## Using Context Sync

Once connected, you can start using Context Sync immediately:

### Initialize a Workspace

```
You: "Set workspace to /path/to/my-project"
```

Context Sync will:
- Detect your project type (React, Node.js, Python, etc.)
- Initialize persistent context storage
- Start tracking your project

### Save Context and Decisions

```
You: "Save this decision: Using React with TypeScript for better type safety"
```

Context Sync stores your architectural decisions and reasoning for future reference.

### Access Project Context

```
You: "What's the current project context?"
```

Get a summary of:
- Project type and structure
- Recent decisions
- Key files and components
- Active TODOs

### Multi-Agent Sessions

Context Sync supports multiple AI agents working on the same project simultaneously:

1. **In Claude Desktop**: Set workspace to your project
2. **In VS Code**: Connect to the same project
3. **Context is synced**: Both agents have access to the same project context

All changes are synchronized in real-time through the persistent database.

## Key Features

### 40+ MCP Tools

Context Sync provides comprehensive tooling:

**Project Management**
- `set_workspace` - Initialize project workspace
- `get_project_context` - Get project overview
- `save_decision` - Record architectural decisions
- `save_conversation` - Save important conversations

**File Operations**
- `read_file` - Read workspace files
- `create_file`, `modify_file`, `delete_file` - File operations with preview
- `apply_create_file`, `apply_modify_file`, `apply_delete_file` - Apply changes after approval
- `search_files`, `search_content` - Search capabilities
- `undo_file_change` - Undo file modifications

**Git Integration**
- `git_status` - Check Git status
- `git_diff` - View changes
- `git_branch_info` - Branch information
- `suggest_commit_message` - AI-powered commit messages

**Code Analysis**
- `analyze_dependencies` - Dependency analysis
- `find_importers` - Find module usage
- `detect_circular_deps` - Detect circular dependencies
- `analyze_call_graph` - Function call analysis
- `find_type_definition` - Type lookup
- `find_type_usages` - Find type usage

**TODO Management**
- `todo_create` - Create project TODOs
- `todo_list` - List TODOs with filters
- `todo_update`, `todo_complete`, `todo_delete` - Manage TODOs
- `todo_stats` - TODO statistics

### Persistent Memory

Context Sync maintains persistent memory across:
- **Sessions**: Context persists between conversations
- **Agents**: Multiple AI agents share the same context
- **Projects**: Switch between projects seamlessly

All context is stored in a local SQLite database mounted at `/data/context-sync.db`.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXT_SYNC_DB_PATH` | `/data/context-sync.db` | Path to SQLite database |
| `NODE_ENV` | `production` | Node environment |

### Volume Mounts

| Volume | Path | Description | Required |
|--------|------|-------------|----------|
| `context-sync-data` | `/data` | Database storage | Yes |
| `workspace` | `/workspace` | Your project workspace | No |

### Advanced Configuration

**Mount Multiple Workspaces:**

```bash
docker mcp server configure context-sync \
  --volume workspace1=/path/to/project1 \
  --volume workspace2=/path/to/project2
```

**Custom Database Location:**

```bash
docker mcp server configure context-sync \
  --env CONTEXT_SYNC_DB_PATH=/custom/path/db.sqlite
```

## Dynamic MCP Features

The Docker MCP Toolkit includes **Dynamic MCP**, which enables:

### On-Demand Tool Discovery

Your AI agent can:
1. Search the MCP catalog during conversations
2. Add Context Sync tools as needed
3. Use tools immediately without manual setup

**Example Workflow:**

```
You: "I need to save project context"
Agent: "I'll use Context Sync for that. Let me add it..."
Agent: [Automatically adds Context Sync from catalog]
Agent: "Context Sync is ready! What would you like to save?"
```

### Automatic Composition

AI agents can compose multiple MCP servers:
- Use Context Sync for memory and project context
- Use other MCP servers for specific tasks
- All working together seamlessly

## Troubleshooting

### Context Sync Not Appearing

1. **Check Docker Desktop MCP Toolkit is enabled**
   ```bash
   docker mcp server list
   ```

2. **Verify Context Sync is enabled**
   ```bash
   docker mcp server status context-sync
   ```

3. **Check logs**
   ```bash
   docker mcp server logs context-sync
   ```

### AI Agent Can't Connect

1. **Ensure gateway is running**
   ```bash
   docker mcp gateway status
   ```

2. **Restart the MCP Toolkit**
   - In Docker Desktop: MCP Toolkit → Restart Gateway

3. **Verify AI agent configuration**
   - Claude Desktop: Check MCP server list in settings
   - VS Code: Check Copilot MCP connections

### Database Issues

1. **Check database volume**
   ```bash
   docker volume inspect context-sync-data
   ```

2. **Reset database (WARNING: deletes all data)**
   ```bash
   docker mcp server configure context-sync --reset
   ```

### Workspace Not Accessible

1. **Verify volume mount**
   ```bash
   docker mcp server inspect context-sync
   ```

2. **Check file permissions**
   - Ensure Docker has access to the workspace directory
   - On macOS: System Preferences → Privacy & Security → Files and Folders

## Examples

### Starting a New Project

```
You: "I'm starting a new React project"
Agent: "Great! Let me set up Context Sync for you."
You: "Set workspace to /Users/me/projects/my-react-app"
Agent: [Context Sync initializes the workspace]
Agent: "Your React project is set up! I can now help you with persistent context, file operations, and more."
```

### Working Across Multiple Agents

**In Claude Desktop:**
```
You: "Set workspace to /projects/api-server"
You: "Save decision: Using Express.js with TypeScript"
```

**Later in VS Code:**
```
You: "What decisions were made for this project?"
Agent: [Retrieves from Context Sync]
Agent: "The project uses Express.js with TypeScript for better type safety..."
```

### Project Context Management

```
You: "What's the current state of my project?"
Agent: [Queries Context Sync]
Agent: "Your project 'api-server' is:
- Type: Node.js + TypeScript
- Key decisions: 3 architectural choices
- Active TODOs: 5 pending, 2 high priority
- Recent files: auth.ts, server.ts, config.ts"
```

## Comparison: Docker MCP Toolkit vs. Traditional Installation

| Feature | Docker MCP Toolkit | NPM Installation |
|---------|-------------------|------------------|
| **Setup Time** | < 1 minute | 5-10 minutes |
| **Configuration** | Automatic | Manual JSON editing |
| **Updates** | Automatic | Manual npm update |
| **Multi-Agent** | Built-in | Requires configuration |
| **Isolation** | Container isolated | System-wide |
| **Dynamic Discovery** | Yes | No |

## Security

Context Sync in Docker MCP Toolkit includes:

- **Container Isolation**: Runs in isolated Docker container
- **Resource Limits**: CPU and memory limits enforced
- **Filesystem Control**: Explicit volume mount permissions
- **Non-Root User**: Runs as unprivileged user (node:node)
- **Local Storage**: Database never leaves your machine

## Support

- **Docker MCP Toolkit Docs**: https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/
- **Context Sync GitHub**: https://github.com/Intina47/context-sync
- **Issues**: https://github.com/Intina47/context-sync/issues
- **Discussions**: https://github.com/Intina47/context-sync/discussions

## Additional Resources

- [Docker MCP Registry](https://github.com/docker/mcp-registry)
- [Contributing to MCP Registry](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md)
- [Context Sync Documentation](../README.md)
- [Docker MCP Integration Guide](../DOCKER_MCP_INTEGRATION.md)

---

**Ready to use Context Sync with Docker MCP Toolkit? Add it from the catalog and start building with persistent AI memory!** 🚀
