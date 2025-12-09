# Docker MCP Integration Guide

Complete guide for using Context Sync with Docker and the Docker MCP Toolkit.

## 🎯 Overview

Context Sync is now available as a Docker container, making it easy to:

- Run without manual environment setup
- Use with the Docker MCP Toolkit
- Deploy in containerized environments
- Ensure consistent behavior across platforms

## 🚀 Quick Start

### For End Users

#### Option 1: Docker MCP Toolkit (Easiest)

Once published to the Docker MCP Registry:

1. Open Docker MCP Toolkit
2. Search for "Context Sync"
3. Click "Enable"
4. Start using immediately!

#### Option 2: Docker Command

```bash
docker run -d \
  --name context-sync \
  -v context-sync-data:/data \
  context-sync/mcp-server:latest
```

#### Option 3: Docker Compose

```bash
cd docker
docker-compose up -d
```

### For Developers

```bash
# Clone repository
git clone https://github.com/Intina47/context-sync.git
cd context-sync

# Build Docker image
./docker/build.sh

# Test locally
cd docker
docker-compose up
```

## 📋 System Requirements

### Minimum Requirements

- **Docker**: 20.10 or later
- **RAM**: 256MB minimum, 512MB recommended
- **Disk**: 1GB for image and data
- **CPU**: 1 core (0.5 recommended minimum)

### Supported Platforms

- Linux (amd64, arm64)
- macOS (Intel, Apple Silicon)
- Windows (WSL2 required)

## 🏗️ Architecture

### Container Design

```
┌─────────────────────────────────────────┐
│         Docker Container                │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Context Sync MCP Server         │ │
│  │   (Node.js 20 Alpine)             │ │
│  │                                   │ │
│  │   • Stdio Transport               │ │
│  │   • 40+ MCP Tools                 │ │
│  │   • SQLite Database               │ │
│  └───────────────────────────────────┘ │
│              ↕                          │
│  ┌───────────────────────────────────┐ │
│  │   Persistent Volume (/data)       │ │
│  │   • context-sync.db               │ │
│  │   • User data & context           │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
         ↕ (stdio)
┌─────────────────────────────────────────┐
│         AI Tool                         │
│  (Claude, Cursor, VS Code, etc.)        │
└─────────────────────────────────────────┘
```

### Multi-Stage Build

The Dockerfile uses multi-stage builds for:

1. **Builder Stage**: Compile TypeScript with full dev dependencies
2. **Production Stage**: Minimal runtime with only production dependencies

Benefits:
- Smaller final image (~200MB vs ~500MB)
- Faster startup times
- Reduced attack surface

## 🔧 Configuration

### Environment Variables

Configure the container using environment variables:

```bash
docker run -d \
  -e CONTEXT_SYNC_DB_PATH=/data/context-sync.db \
  -e NODE_ENV=production \
  -v context-sync-data:/data \
  context-sync/mcp-server:latest
```

Available variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CONTEXT_SYNC_DB_PATH` | Database file path | `/data/context-sync.db` |
| `NODE_ENV` | Node environment | `production` |

### Volume Mounts

#### Required Volumes

```bash
# Database persistence (required)
-v context-sync-data:/data
```

#### Optional Volumes

```bash
# Workspace access for file operations (optional)
-v /path/to/workspace:/workspace:ro

# Custom configuration (optional)
-v /path/to/config:/config:ro
```

### Docker Compose Configuration

Full example in `docker/docker-compose.yml`:

```yaml
services:
  context-sync-mcp:
    image: context-sync/mcp-server:latest
    environment:
      - NODE_ENV=production
      - CONTEXT_SYNC_DB_PATH=/data/context-sync.db
    volumes:
      - context-sync-data:/data
    restart: unless-stopped
```

## 🔌 AI Tool Integration

### Claude Desktop

**macOS:**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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
        "context-sync/mcp-server:latest"
      ]
    }
  }
}
```

**Windows:**

Edit `%APPDATA%\Claude\claude_desktop_config.json` with the same configuration.

**Linux:**

Edit `~/.config/Claude/claude_desktop_config.json` with the same configuration.

### Cursor IDE

Add to Cursor MCP settings:

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
        "context-sync/mcp-server:latest"
      ]
    }
  }
}
```

### VS Code (GitHub Copilot)

Configure in VS Code settings for MCP integration:

```json
{
  "mcp.servers": {
    "context-sync": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v", "context-sync-data:/data",
        "context-sync/mcp-server:latest"
      ]
    }
  }
}
```

### Continue.dev

Edit `~/.continue/config.yaml`:

```yaml
mcpServers:
  context-sync:
    command: docker
    args:
      - run
      - --rm
      - -i
      - -v
      - context-sync-data:/data
      - context-sync/mcp-server:latest
```

## 🧪 Testing & Validation

### Build Test

```bash
# Build image
./docker/build.sh

# Verify build
docker images context-sync/mcp-server
```

### Runtime Test

```bash
# Start container
docker run -d --name test-context-sync \
  -v test-data:/data \
  context-sync/mcp-server:latest

# Check health
docker ps | grep test-context-sync
docker inspect --format='{{.State.Health.Status}}' test-context-sync

# View logs
docker logs test-context-sync

# Cleanup
docker rm -f test-context-sync
docker volume rm test-data
```

### Interactive Test

```bash
# Test stdio communication
docker run --rm -it \
  -v context-sync-data:/data \
  context-sync/mcp-server:latest
```

Expected output:
```
Context Sync MCP server v1.0.0 running on stdio
```

### Integration Test

Test with an AI tool:

1. Configure AI tool with Docker integration (see above)
2. Restart the AI tool completely
3. Open a new conversation
4. Test: "help me get started with context-sync"

The AI should respond with Context Sync features.

## 📊 Performance

### Resource Usage

Typical resource consumption:

| Metric | Idle | Active | Peak |
|--------|------|--------|------|
| **Memory** | 50MB | 150MB | 300MB |
| **CPU** | <1% | 5-10% | 20-30% |
| **Disk I/O** | Minimal | Moderate | High |

### Optimization Tips

1. **Use volume mounts** instead of bind mounts for better performance
2. **Limit memory** to 512MB to prevent resource hogging:
   ```bash
   docker run --memory=512m ...
   ```
3. **Use read-only workspace mounts** when possible:
   ```bash
   -v /workspace:/workspace:ro
   ```

## 🔐 Security

### Container Security

- Runs as non-root user (`node:node`, UID 1000)
- Minimal Alpine base image
- No unnecessary packages
- Production-only dependencies in final image

### Data Security

- Database stored in dedicated volume (not in container)
- No data sent to external services
- Local-first architecture
- SQLite database with standard security

### Best Practices

1. **Use read-only mounts** for workspace:
   ```bash
   -v /workspace:/workspace:ro
   ```

2. **Limit container capabilities**:
   ```bash
   docker run --cap-drop=ALL --cap-add=CHOWN ...
   ```

3. **Use Docker secrets** for sensitive config:
   ```bash
   docker run --secret my-secret ...
   ```

4. **Regular updates**:
   ```bash
   docker pull context-sync/mcp-server:latest
   ```

## 🐛 Troubleshooting

### Container Won't Start

**Problem**: Container exits immediately

**Solution**:
```bash
# Check logs
docker logs context-sync-mcp

# Common issues:
# - Volume permission denied → Fix volume ownership
# - Database locked → Stop other instances
# - Port conflict → Change exposed port
```

### MCP Communication Fails

**Problem**: AI tool can't connect to MCP server

**Solution**:
```bash
# Verify container is running
docker ps | grep context-sync

# Test stdio manually
docker run --rm -it context-sync/mcp-server:latest

# Check AI tool config syntax (JSON must be valid)
```

### Performance Issues

**Problem**: Slow response times

**Solution**:
```bash
# Check resource usage
docker stats context-sync-mcp

# Increase memory limit
docker update --memory=1g context-sync-mcp

# Check disk space
docker system df
```

### Database Issues

**Problem**: Database corruption or errors

**Solution**:
```bash
# Backup first!
docker run --rm \
  -v context-sync-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup.tar.gz /data

# Reset database (WARNING: deletes all data)
docker volume rm context-sync-data
```

## 🔄 Maintenance

### Updates

```bash
# Pull latest image
docker pull context-sync/mcp-server:latest

# Stop old container
docker stop context-sync-mcp

# Remove old container
docker rm context-sync-mcp

# Start new container
docker run -d --name context-sync-mcp \
  -v context-sync-data:/data \
  context-sync/mcp-server:latest
```

### Backups

```bash
# Backup database
docker run --rm \
  -v context-sync-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/context-sync-$(date +%Y%m%d).tar.gz /data

# Restore database
docker run --rm \
  -v context-sync-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/context-sync-YYYYMMDD.tar.gz -C /
```

### Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (careful!)
docker volume prune

# Complete cleanup
docker system prune -a --volumes
```

## 📦 Publishing to Docker MCP Registry

### Steps to Publish

1. **Prepare Image**
   ```bash
   # Multi-platform build
   docker buildx build \
     --platform linux/amd64,linux/arm64 \
     -t contextsynchq/context-sync-mcp:1.0.0 \
     -t contextsynchq/context-sync-mcp:latest \
     --push \
     -f docker/Dockerfile .
   ```

2. **Fork MCP Registry**
   ```bash
   # Fork https://github.com/docker/mcp-registry
   git clone https://github.com/YOUR-USERNAME/mcp-registry
   ```

3. **Add MCP Manifest**
   ```bash
   # Copy mcp.json to registry
   cp docker/mcp.json mcp-registry/servers/context-sync/mcp.json
   ```

4. **Submit PR**
   - Follow [CONTRIBUTING.md](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md)
   - Include documentation
   - Add tests/examples

5. **Wait for Review**
   - Docker team reviews submissions
   - Address any feedback
   - Merge into registry

### Registry Requirements

- [ ] Valid `mcp.json` with complete metadata
- [ ] Multi-platform Docker images (amd64, arm64)
- [ ] Published to Docker Hub or GitHub Container Registry
- [ ] Documentation and examples
- [ ] Health check implementation
- [ ] Tested with Docker MCP Toolkit
- [ ] Security best practices followed
- [ ] Versioning strategy (semantic versioning)

## 🎓 Advanced Usage

### Custom Base Image

Create your own Dockerfile based on Context Sync:

```dockerfile
FROM context-sync/mcp-server:latest

# Add your customizations
RUN apk add --no-cache your-package

# Copy custom configuration
COPY custom-config.json /config/
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build Docker Image

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            context-sync/mcp-server:latest
            context-sync/mcp-server:${{ github.ref_name }}
```

### Kubernetes Deployment

Example Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: context-sync-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: context-sync-mcp
  template:
    metadata:
      labels:
        app: context-sync-mcp
    spec:
      containers:
      - name: context-sync
        image: context-sync/mcp-server:latest
        env:
        - name: NODE_ENV
          value: "production"
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          limits:
            memory: "512Mi"
            cpu: "1000m"
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: context-sync-data
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/)
- [MCP Registry](https://github.com/docker/mcp-registry)
- [Context Sync Main Docs](README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

## 💬 Support

- **GitHub Issues**: [Report bugs](https://github.com/Intina47/context-sync/issues)
- **Discussions**: [Ask questions](https://github.com/Intina47/context-sync/discussions)
- **Docker Hub**: [View images](https://hub.docker.com/r/contextsynchq/context-sync-mcp)

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

**Ready to deploy Context Sync with Docker? Get started now! 🚀**
