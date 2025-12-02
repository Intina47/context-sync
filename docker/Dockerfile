# Context Sync MCP Server - Docker Image
# Optimized for Docker MCP Toolkit integration
# Based on Issue #12 by @aakaashjois

FROM node:20-alpine AS builder

# Add metadata for Docker MCP Registry
LABEL org.opencontainers.image.title="Context Sync MCP Server"
LABEL org.opencontainers.image.description="Universal context synchronization across AI platforms"
LABEL org.opencontainers.image.authors="Context Sync Community"
LABEL org.opencontainers.image.source="https://github.com/Intina47/context-sync"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="1.0.0"

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files and build config
COPY package*.json ./
COPY tsconfig.json ./

# Copy bin directory first (needed for postinstall script)
COPY bin/ ./bin/

# Copy source code BEFORE npm ci (needed for build during postinstall)
COPY src/ ./src/

# Install ALL dependencies (including dev deps for building)
RUN npm ci

# Build the application
RUN npm run build

# Clean up dev dependencies after build
RUN npm prune --production

# Production stage
FROM node:20-alpine

# Add runtime labels
LABEL org.opencontainers.image.title="Context Sync MCP Server"
LABEL org.opencontainers.image.description="Universal context synchronization across AI platforms"
LABEL mcp.server.name="context-sync"
LABEL mcp.server.version="1.0.0"
LABEL mcp.capabilities="tools,resources,prompts"

# Install runtime dependencies only
RUN apk add --no-cache sqlite

# Create non-root user
RUN addgroup -g 1001 -S contextSync && \
    adduser -S contextSync -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/bin ./bin

# Create data directory with proper permissions
RUN mkdir -p /data && \
    chown -R contextSync:contextSync /app /data

# Copy entrypoint script
COPY docker/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER contextSync

# Expose MCP port (for health check only - MCP uses stdio)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Set default command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]