# Building Context Sync Docker Image

## Overview

Context Sync provides multiple Dockerfile options depending on your build environment.

## Dockerfile Options

### 1. Dockerfile (Multi-Stage Build)

**Use when**: Building in a stable environment with reliable package managers.

```bash
docker build -f docker/Dockerfile -t intina47/context-sync-mcp:latest .
```

This Dockerfile:
- Uses multi-stage builds for optimal image size
- Compiles TypeScript from source
- Installs dependencies cleanly
- Recommended for CI/CD pipelines

### 2. Dockerfile.prebuilt (Prebuilt Distribution)

**Use when**: You've already built the project locally or npm install fails in Docker.

```bash
# Build locally first
npm install
npm run build

# Then build Docker image
docker build -f docker/Dockerfile.prebuilt -t intina47/context-sync-mcp:latest .
```

This Dockerfile:
- Assumes `dist/` directory exists
- Copies prebuilt TypeScript output
- Faster builds for development
- Workaround for npm issues in some Docker environments

## Known Issues

### NPM "Exit Handler Never Called" Error

Some Docker environments experience issues where npm install appears to complete but doesn't extract packages correctly. This manifests as:

```
npm error Exit handler never called!
```

**Solution**: Use Dockerfile.prebuilt and build locally first.

### Alpine Package Repository TLS Errors

Alpine Linux package repositories may have TLS issues in some environments:

```
WARNING: fetching https://dl-cdn.alpinelinux.org/alpine/...: TLS: unspecified error
```

**Solution**: Use the Debian-based images (node:20-slim) as provided in Dockerfile.prebuilt.

## Recommended Build Process

### For Development

```bash
# 1. Build project locally
npm install
npm run build

# 2. Build Docker image with prebuilt dist
docker build -f docker/Dockerfile.prebuilt -t intina47/context-sync-mcp:dev .

# 3. Test
docker run --rm -v test-data:/data intina47/context-sync-mcp:dev
```

### For Production

```bash
# Use Docker Compose for convenience
cd docker
docker-compose build
docker-compose up -d
```

### For CI/CD

```yaml
# GitHub Actions example
- name: Build Docker image
  run: |
    npm install
    npm run build
    docker build -f docker/Dockerfile.prebuilt \
      -t ${{ github.repository }}:${{ github.sha }} \
      .
```

## Multi-Platform Builds

For publishing to Docker Hub with multiple architectures:

```bash
# Setup buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile.prebuilt \
  -t intina47/context-sync-mcp:latest \
  --push \
  .
```

## Troubleshooting

### Build Fails with "Dependencies not installed!"

This means npm install completed but didn't extract files correctly.

**Solution**:
```bash
# Build locally first
npm install
npm run build

# Use prebuilt Dockerfile
docker build -f docker/Dockerfile.prebuilt -t intina47/context-sync-mcp .
```

### "Cannot find module" at Runtime

Dependencies weren't installed correctly during build.

**Solution**:
```bash
# Verify dependencies in image
docker run --rm your-image ls -la /app/node_modules/@modelcontextprotocol/sdk/

# If empty, rebuild with prebuilt approach
```

### Build Takes Too Long

Multi-stage builds can be slow due to npm install.

**Solution**:
```bash
# Use prebuilt approach
# Cache node_modules with Docker BuildKit
DOCKER_BUILDKIT=1 docker build --cache-from ...
```

## Best Practices

1. **Always test locally first** before building Docker images
2. **Use .dockerignore** to exclude unnecessary files
3. **Pin dependency versions** in package-lock.json
4. **Use multi-stage builds** for production images
5. **Tag images properly** with semantic versioning

## Support

If you encounter build issues:
1. Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
2. Open an issue on [GitHub](https://github.com/Intina47/context-sync/issues)
3. Include:
   - Docker version (`docker --version`)
   - Build command used
   - Full error output
   - Your environment (OS, CI system, etc.)
