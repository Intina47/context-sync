#!/bin/sh
# Docker entrypoint for Context Sync MCP Server
# Based on community request from @aakaashjois (Issue #12)

set -e

# Default configuration values
WORKSPACE_ROOT=${WORKSPACE_ROOT:-/workspace}
DATA_DIR=${DATA_DIR:-/data}
HEALTH_PORT=${HEALTH_PORT:-3000}

# TODO @aakaashjois: Add more robust error handling and validation here
# Consider adding configuration validation, dependency checks, etc.

echo "🚀 Starting Context Sync MCP Server..."
echo "📁 Workspace: $WORKSPACE_ROOT"
echo "💾 Data Directory: $DATA_DIR"
echo "🔌 Health Check Port: $HEALTH_PORT"
echo "📡 MCP Transport: stdio (standard MCP protocol)"

# Ensure data directory exists and has proper permissions
if [ ! -d "$DATA_DIR" ]; then
    echo "📂 Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# TODO @aakaashjois: Consider adding workspace validation
# Check if workspace directory is mounted and accessible
if [ ! -d "$WORKSPACE_ROOT" ]; then
    echo "⚠️  Warning: Workspace directory $WORKSPACE_ROOT not found"
    echo "   Make sure to mount your project directory to /workspace"
    # Create it anyway to prevent crashes
    mkdir -p "$WORKSPACE_ROOT"
fi

# Set environment variables for the application
export CONTEXT_SYNC_WORKSPACE_ROOT="$WORKSPACE_ROOT"
export CONTEXT_SYNC_DATA_DIR="$DATA_DIR"
export CONTEXT_SYNC_HEALTH_PORT="$HEALTH_PORT"

# TODO @aakaashjois: Add configuration file support
# Consider reading from /app/config/docker-config.json or similar
# This would allow more sophisticated configuration than env vars

# Initialize database if needed
echo "🗄️  Initializing database..."
# The application will handle database setup on first run

echo "✅ Context Sync MCP Server ready!"
echo "🔗 Health check available at: http://localhost:$HEALTH_PORT/health"
echo "📡 MCP communication via stdio (connect your MCP client to this container)"

# TODO @aakaashjois: Add signal handling for graceful shutdown
# Consider trap signals and cleanup resources properly

# Execute the command passed to docker run
exec "$@"