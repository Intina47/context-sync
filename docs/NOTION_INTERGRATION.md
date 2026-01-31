# Notion Integration Guide

Context Sync can connect directly to Notion using the official Notion API. The MCP tool exposes **search** and **read** actions once configured.

## What you get
- Search for pages in your workspace.
- Read page content directly in your AI client.

> Note: The public MCP tool currently supports **read-only** operations.

## Prerequisites
- Node.js 16+
- A Notion workspace
- A Notion integration token

## Step 1: Create a Notion integration
1. Visit https://www.notion.so/profile/integrations
2. Click **New integration**
3. Name it (e.g., “Context Sync”)
4. Select your workspace and submit

## Step 2: Share pages with the integration
Open a page in Notion → **Share** → invite the integration. The integration can only access pages you share.

## Step 3: Install Context Sync
```bash
npm install -g @context-sync/server
```

## Step 4: Run the setup wizard
```bash
context-sync-setup
# or
npx context-sync-setup
```
The wizard prompts for:
- Integration token (`secret_` or `ntn_`)
- Optional default parent page ID (future write workflows)

This stores configuration in `~/.context-sync/config.json`.

## Step 5: Use the Notion tool
```json
notion({ "action": "search", "query": "architecture" })
notion({ "action": "read", "pageId": "<uuid>" })
```

If you see “Notion is not configured,” rerun the setup wizard.

## Troubleshooting
**"Integration not found"**
- Verify the token in `~/.context-sync/config.json`.
- Confirm the integration exists at https://www.notion.so/my-integrations.

**"Page not accessible"**
- Ensure the page is shared with your integration.
- Check workspace permissions.

**"Failed to read page"**
- Confirm the page ID is a valid UUID.

## Security best practices
- Keep tokens out of source control.
- Limit access to specific pages.
- Revoke unused integrations regularly.
