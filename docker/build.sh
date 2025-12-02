#!/bin/bash
# Build script for Context Sync Docker image
# Usage: ./docker/build.sh [tag]

set -e

# Default tag
TAG=${1:-latest}
IMAGE_NAME="context-sync"

echo "🐳 Building Context Sync Docker image..."
echo "Image: $IMAGE_NAME:$TAG"

# Change to project root
cd "$(dirname "$0")/.."

# Build the image
docker build -f docker/Dockerfile -t "$IMAGE_NAME:$TAG" .

echo "✅ Docker image built successfully!"
echo "Image: $IMAGE_NAME:$TAG"
echo ""
echo "Next steps:"
echo "1. Test locally: docker run -it --rm -v \$(pwd):/workspace -v \$(pwd)/data:/data $IMAGE_NAME:$TAG"
echo "2. Run with docker-compose: cd docker && docker-compose up"
echo "3. Check health: curl http://localhost:3000/health"