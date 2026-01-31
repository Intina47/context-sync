#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="@context-sync/server"
VERSION_SUFFIX=""

if [[ -n "${CONTEXT_SYNC_VERSION:-}" ]]; then
  VERSION_SUFFIX="@${CONTEXT_SYNC_VERSION}"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is required (>= 18). Install Node.js and retry." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is required. Install npm and retry." >&2
  exit 1
fi

echo "🧠 Installing Context Sync MCP Server..."

npm install -g "${PACKAGE_NAME}${VERSION_SUFFIX}"

echo "✅ Install complete. Restart your AI tool to load Context Sync."
