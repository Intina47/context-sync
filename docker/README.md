# Docker MCP Implementation for Context Sync

# Docker MCP Implementation for Context Sync

> **Key Principle**: The Docker version works **identically** to the npm version, just containerized. Same functionality, same SQLite persistence, same MCP tools - just packaged in Docker for easy distribution and deployment.

## 🎯 Docker = npm + Container

This Docker implementation:
- ✅ **Same functionality** as `npm install @context-sync/server`
- ✅ **Same SQLite database** - just mounted to survive container restarts
- ✅ **Same MCP tools** - all 40+ tools work identically
- ✅ **Same stdio transport** - no changes to MCP communication
- ✅ **Same configuration** - just uses environment variables instead of CLI args

## 📁 File Structure

```
docker/
├── README.md           # This documentation
├── Dockerfile          # Multi-stage Docker build
├── docker-entrypoint.sh # Container initialization script  
├── mcp.json           # MCP manifest for Docker Registry
├── docker-compose.yml # Example compose configuration
├── build.sh           # Build helper script
└── .dockerignore      # Docker build exclusions
```

This implementation packages Context Sync as a Docker MCP server compatible with the Docker MCP Toolkit.

## 🚀 Quick Start

### Build the Image
```bash
docker build -t context-sync:latest .
```
or

```
./docker/build.sh   
```

### Run Locally
```bash
# Create required directories
mkdir -p ./workspace ./data

# Run the container
docker run -it --rm \
  -v $(pwd)/workspace:/workspace \
  -v $(pwd)/data:/data \
  -p 3000:3000 \
  context-sync:latest
```

### Test MCP Connection
```bash
# The container runs an MCP server over stdio
# Test health endpoint
curl http://localhost:3000/health
```

## 🗄️ Persistence Strategy

The Docker version uses the **exact same SQLite database** as the npm version:

```bash
# npm version stores data in:
~/.context-sync/data.db

# Docker version stores data in:
/data/context-sync.db (mounted to host)
```

**Volume Mount Required**: 
- Mount host directory to `/data` to persist SQLite database
- Database survives container restarts, updates, and rebuilds
- Same schema, same data, same functionality as npm version

## 📋 Configuration

Environment variables mirror the npm CLI options:

| Docker Environment | npm CLI Equivalent | Description |
|-------------------|-------------------|-------------|
| `WORKSPACE_ROOT=/workspace` | `--workspace-root` | Project workspace directory |
| `DATA_DIR=/data` | `--db-path` | SQLite database location |
| `CONTEXT_SYNC_HEALTH_PORT=3000` | _(Docker only)_ | Optional health check |
| `CONTEXT_SYNC_MAX_FILE_SIZE=1048576` | `--max-file-size` | Max file processing size |
| `CONTEXT_SYNC_ENABLE_WATCHING=true` | `--enable-watching` | File system monitoring |

## 🐳 Docker MCP Toolkit Integration

### Volume Mounts Required
- **Workspace**: Mount your project to `/workspace`
- **Data**: Mount persistent storage to `/data`

### Example docker-compose.yml
```yaml
version: '3.8'
services:
  context-sync:
    image: context-sync:latest
    volumes:
      - ./your-project:/workspace
      - ./context-sync-data:/data
    environment:
      - WORKSPACE_ROOT=/workspace
      - DATA_DIR=/data
    ports:
      - "3000:3000"
```

## 🔧 MCP Capabilities

This Docker image exposes all Context Sync MCP tools:

### Core Tools
- `get_project_context` - Get project context and history
- `save_decision` - Save architectural decisions
- `save_conversation` - Save conversation snippets
- `read_file` - Read workspace files
- `search_files` - Search for files
- `search_content` - Search file contents

### File Operations
- `create_file` / `apply_create_file` - Preview and create files
- `modify_file` / `apply_modify_file` - Preview and modify files
- `delete_file` / `apply_delete_file` - Preview and delete files

### TODO Management
- `todo_create`, `todo_list`, `todo_update`, `todo_complete`
- Full TODO system with priorities and project association

### Analysis Tools
- `analyze_dependencies` - Dependency analysis
- `analyze_call_graph` - Function call analysis
- `find_type_definition` - Type analysis
- `git_status`, `git_diff` - Git integration

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Docker MCP    │    │   Context Sync   │    │   SQLite DB     │
│   Toolkit       │◄──►│   MCP Server     │◄──►│   (/data)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Workspace     │
                       │   (/workspace)  │
                       └─────────────────┘
```

## 🧪 Testing & Validation

### Local Testing
1. Build the image: `docker build -t context-sync:latest .`
2. Run with test workspace: `docker run -it --rm -v $(pwd):/workspace -v $(pwd)/test-data:/data context-sync:latest`
3. Verify health endpoint: `curl http://localhost:3000/health`
4. Test MCP tools through Docker MCP Toolkit

### Validation Checklist
- [ ] Image builds without errors
- [ ] Container starts and initializes database
- [ ] Health check endpoint responds
- [ ] MCP tools are accessible
- [ ] File operations work with mounted volumes
- [ ] Persistent data survives container restart

## 🤝 Contributing (@aakaashjois)

This MVP implementation provides a solid foundation, but there are several areas for improvement:

### TODO: Testing & Validation
- [ ] **Comprehensive testing** with Docker MCP Toolkit
- [ ] **Performance testing** with large workspaces
- [ ] **Multi-platform testing** (Linux, macOS, Windows)
- [ ] **Memory usage optimization**

### TODO: Error Handling
- [ ] **Graceful container shutdown** with proper signal handling
- [ ] **Better error messages** for configuration issues
- [ ] **Recovery from corrupted data** directory
- [ ] **Validation of mounted volumes**

### TODO: Configuration
- [ ] **Configuration file support** (JSON/YAML)
- [ ] **Environment-specific configs** (dev/prod)
- [ ] **Advanced MCP server options**
- [ ] **Logging configuration**

### TODO: Documentation
- [ ] **Docker MCP Registry submission**
- [ ] **Integration examples** with popular IDEs
- [ ] **Troubleshooting guide**
- [ ] **Performance tuning guide**

### TODO: Registry Submission
- [ ] **Validate against Docker MCP Registry requirements**
- [ ] **Create registry submission PR**
- [ ] **Add CI/CD for automated testing**
- [ ] **Version tagging strategy**

## 🎯 Design Decisions

### Why SQLite in Container?
- Simplicity for MVP
- Good performance for single-user scenarios
- Easy backup/restore with volume mounts
- TODO: Consider PostgreSQL for multi-user scenarios

### Why Node.js Alpine?
- Smaller image size
- Good TypeScript/npm support
- Wide compatibility
- TODO: Consider distroless images for production

### Why Stdio Transport?
- Standard MCP protocol
- Compatible with Docker MCP Toolkit
- Simple and reliable
- TODO: Consider HTTP transport for web-based tools

## 🔗 Links
- [Docker MCP Toolkit Docs](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/)
- [Docker MCP Registry](https://github.com/docker/mcp-registry)
- [Context Sync Repository](https://github.com/Intina47/context-sync)

---

*Built with ❤️ for the MCP community. First Docker implementation requested by @aakaashjois in Issue #12.*