#!/bin/bash

# Build script for Context Sync MCP Server Docker image
# Usage: ./build.sh [tag]

set -e

# Default tag
TAG="${1:-latest}"
IMAGE_NAME="context-sync/mcp-server"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building Context Sync MCP Server Docker image...${NC}"
echo -e "${BLUE}Image: ${IMAGE_NAME}:${TAG}${NC}"
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Build the Docker image
echo -e "${BLUE}Step 1: Building Docker image...${NC}"
docker build \
  -f docker/Dockerfile \
  -t "${IMAGE_NAME}:${TAG}" \
  -t "${IMAGE_NAME}:1.0.0" \
  .

echo ""
echo -e "${GREEN}✓ Build complete!${NC}"
echo ""
echo -e "${BLUE}Image details:${NC}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Test the image: docker run --rm -it ${IMAGE_NAME}:${TAG}"
echo "  2. Use with compose: cd docker && docker-compose up"
echo "  3. Push to registry: docker push ${IMAGE_NAME}:${TAG}"
echo ""
echo -e "${GREEN}Done!${NC}"
