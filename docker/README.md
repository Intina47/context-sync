# Context Sync MCP Server - Docker Integration

This directory contains everything needed to run Context Sync as a Docker container, including integration with the **Docker MCP Toolkit**.

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# From the docker directory
cd docker
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### Option 2: Using Docker CLI

```bash
# Build the image
./docker/build.sh

# Run the container
docker run -d \
  --name context-sync-mcp \
  -v context-sync-data:/data \
  intina47/context-sync-mcp:latest

# Check logs
docker logs -f context-sync-mcp
```

### Option 3: Using Docker MCP Toolkit

Once published to the Docker MCP Registry:

```bash
# Pull and run from Docker MCP Toolkit
docker run --rm -p 3000:3000 intina47/context-sync-mcp:latest
```

Or select **"Context Sync"** directly from the Docker MCP Toolkit UI.

## 📋 Prerequisites

- **Docker** 20.10 or later
- **Docker Compose** 1.29 or later (for compose option)
- At least 512MB RAM available
- 1GB disk space for image and data

## 🏗️ Building the Image

### Standard Build

```bash
./build.sh
```

### Build with Custom Tag

```bash
./build.sh v1.0.0
```

### Multi-Platform Build

For publishing to Docker Hub (requires buildx):

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t intina47/context-sync-mcp:latest \
  -f docker/Dockerfile \
  --push \
  .
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CONTEXT_SYNC_DB_PATH` | Path to SQLite database | `/data/context-sync.db` | No |
| `NODE_ENV` | Node environment | `production` | No |

### Volumes

| Volume | Description | Required |
|--------|-------------|----------|
| `/data` | Persistent storage for database | Yes |
| `/workspace` | Mount your workspace for file operations | No |

### Example with Workspace Mount

```bash
docker run -d \
  --name context-sync-mcp \
  -v context-sync-data:/data \
  -v /path/to/your/project:/workspace:ro \
  -e CONTEXT_SYNC_DB_PATH=/data/context-sync.db \
  intina47/context-sync-mcp:latest
```

## 🔌 Integration with AI Tools

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "context-sync": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v", "context-sync-data:/data",
        "intina47/context-sync-mcp:latest"
      ]
    }
  }
}
```

### Cursor IDE

Add to Cursor settings:

```json
{
  "mcpServers": {
    "context-sync": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v", "context-sync-data:/data",
        "intina47/context-sync-mcp:latest"
      ]
    }
  }
}
```

### VS Code (GitHub Copilot)

Similar configuration in VS Code settings for MCP servers.

## 🧪 Testing the Setup

### Test Container Health

```bash
# Check if container is running
docker ps | grep context-sync

# Check health status
docker inspect --format='{{.State.Health.Status}}' context-sync-mcp

# View logs
docker logs context-sync-mcp
```

### Test MCP Communication

```bash
# Interactive test (stdio transport)
docker run --rm -it \
  -v context-sync-data:/data \
  intina47/context-sync-mcp:latest
```

The server should start and display:
```
Context Sync MCP server v1.0.0 running on stdio
```

## 📊 Monitoring

### View Resource Usage

```bash
# Container stats
docker stats context-sync-mcp

# Detailed inspection
docker inspect context-sync-mcp
```

### Database Management

```bash
# Backup database
docker run --rm \
  -v context-sync-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/context-sync-backup.tar.gz /data

# Restore database
docker run --rm \
  -v context-sync-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/context-sync-backup.tar.gz -C /
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker logs context-sync-mcp

# Check if port is already in use
netstat -an | grep 3000

# Remove and recreate
docker rm -f context-sync-mcp
docker-compose up -d
```

### Database Issues

```bash
# Reset database (WARNING: deletes all data)
docker volume rm context-sync-data
docker-compose up -d
```

### Permission Issues

The container runs as the `node` user (non-root). Ensure volumes have appropriate permissions:

```bash
# Fix volume permissions
docker run --rm \
  -v context-sync-data:/data \
  alpine chown -R 1000:1000 /data
```

## 🔐 Security Considerations

- Container runs as non-root user (`node:node`)
- No unnecessary ports exposed by default
- Minimal Alpine-based image for reduced attack surface
- Database stored in dedicated volume (not in container)
- Read-only workspace mounts recommended

## 📦 Files in This Directory

- **Dockerfile** - Multi-stage Docker build configuration
- **mcp.json** - Docker MCP Registry manifest
- **docker-compose.yml** - Compose configuration for local testing
- **build.sh** - Build script with sensible defaults
- **README.md** - This file

## 🔄 Updating

### Update to Latest Version

```bash
# Pull latest image (when published)
docker pull intina47/context-sync-mcp:latest

# Recreate container
docker-compose down
docker-compose up -d
```

### Build from Source

```bash
# Pull latest source
git pull origin main

# Rebuild image
./docker/build.sh

# Restart container
docker-compose restart
```

## 🌐 Publishing to Docker MCP Registry

### Prerequisites

1. Fork [docker/mcp-registry](https://github.com/docker/mcp-registry)
2. Add `mcp.json` to the registry
3. Submit PR following [CONTRIBUTING.md](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md)

### Registry Submission Checklist

- [ ] `mcp.json` manifest with correct schema
- [ ] Docker image published to Docker Hub
- [ ] Multi-platform builds (amd64, arm64)
- [ ] Documentation and examples
- [ ] Tested with Docker MCP Toolkit
- [ ] Health check implemented
- [ ] Security best practices followed

## 📖 Additional Resources

- [Docker MCP Toolkit Documentation](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/)
- [MCP Registry Contributing Guide](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md)
- [Context Sync Main Documentation](../README.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/Intina47/context-sync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Intina47/context-sync/discussions)
- **Email**: Check repository for contact information

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details

---

**Built with ❤️ by the Context Sync community**
