# Multi-stage build for Context Sync MCP Server
# Optimized for Docker MCP Toolkit integration

# Stage 1: Builder
FROM node:20-slim AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for building)
# Use --legacy-peer-deps to resolve dependency conflicts in older packages
# This allows installation to proceed even if peer dependencies don't match exactly
RUN npm install --legacy-peer-deps && \
    ls -la node_modules/.bin/ && \
    test -f node_modules/.bin/tsc || (echo "tsc not found!" && exit 1)

# Copy source code
COPY src/ ./src/
COPY bin/ ./bin/

# Build TypeScript code
RUN npm run build

# Stage 2: Production
FROM node:20-slim

# Install runtime dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Copy additional files
COPY LICENSE ./
COPY README.md ./

# Set environment variables
ENV NODE_ENV=production
ENV CONTEXT_SYNC_DB_PATH=/data/context-sync.db

# Create data directory for persistent storage
RUN mkdir -p /data && chown -R node:node /data /app

# Switch to non-root user for security
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Context Sync MCP Server is running')" || exit 1

# Expose port for potential HTTP/WebSocket transport (optional)
# Note: MCP primarily uses stdio transport, but this is for future extensions
EXPOSE 3000

# Default command - run the MCP server
CMD ["node", "dist/index.js"]
