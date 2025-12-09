#!/bin/bash

# Build script for Context Sync MCP Server Docker image
# Usage: ./build.sh [tag] [dockerfile]

set -e

# Default values
TAG="${1:-latest}"
DOCKERFILE="${2:-docker/Dockerfile.prebuilt}"
IMAGE_NAME="intina47/context-sync-mcp"
VERSION="1.0.0"  # TODO: Extract from package.json

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building Context Sync MCP Server Docker image...${NC}"
echo -e "${BLUE}Image: ${IMAGE_NAME}:${TAG}${NC}"
echo -e "${BLUE}Dockerfile: ${DOCKERFILE}${NC}"
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Check if using prebuilt Dockerfile
if [[ "$DOCKERFILE" == *"prebuilt"* ]]; then
  echo -e "${YELLOW}Using prebuilt Dockerfile - ensuring project is built...${NC}"
  
  # Check if dist exists
  if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building project...${NC}"
    npm install
    npm run build
  else
    echo -e "${GREEN}✓ dist/ directory exists${NC}"
  fi
  echo ""
fi

# Build the Docker image
echo -e "${BLUE}Building Docker image...${NC}"
docker build \
  -f "${DOCKERFILE}" \
  -t "${IMAGE_NAME}:${TAG}" \
  -t "${IMAGE_NAME}:${VERSION}" \
  .

echo ""
echo -e "${GREEN}✓ Build complete!${NC}"
echo ""
echo -e "${BLUE}Image details:${NC}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Test the image: docker run --rm -it -v test-data:/data ${IMAGE_NAME}:${TAG}"
echo "  2. Use with compose: cd docker && docker-compose up"
echo "  3. Push to registry: docker push ${IMAGE_NAME}:${TAG}"
echo ""
echo -e "${GREEN}Done!${NC}"
