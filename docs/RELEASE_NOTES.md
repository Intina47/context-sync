# Release notes

## Unreleased
- Added a centralized news pipeline configuration with new tech-news sources and a Product Hunt top-5 launches section.

This release is a major v2-focused cleanup. It removes legacy v1 tooling and narrows the surface area to the v2 core server, engines, storage, Notion, and git hooks.

## Highlights
- Unified auto-config format with per-platform adapters.
- Notion-only setup wizard with clearer prompts and retry flow.
- Post-install status tracking with manual-config fallback when auto-config fails.
- Setup wizard now summarizes auto-configured platforms and any install issues.

## Breaking changes
- Removed v1-only tools (todos, platform sync, call graph, type analysis, dependency analysis, file write/preview tools, performance monitor, migration prompter, and related modules).
- Removed legacy documentation set in favor of the new docs.
- Renamed v2-specific source files to scalable names (no "optimized" or "v2" suffixing).

## Required user actions
1) Reinstall the package to re-run auto-config.
2) If auto-config fails, follow `docs/CONFIG.md`.
3) Re-run the Notion setup wizard if you need Notion integration.

## Compatibility
- Supported platforms: Claude Desktop, Cursor, VS Code + GitHub Copilot, Continue.dev, Zed, Windsurf, Codeium, TabNine, Codex CLI, Claude Code, Antigravity.

## Notes
- Auto-config does not run on local installs; use global install or manual config.
- Notion setup is intentionally manual via the wizard.
- Fixed Windows setup command failing due to a stray BOM in the setup script.
