# Notion MCP Integration Guide

## Overview

This guide shows you how to integrate Notion's official MCP server with Context Sync, enabling AI assistants to read and write Notion pages, search your knowledge base, and manage documentation.

## Prerequisites

- Node.js 16+ installed
- A Notion account with workspace access
- Notion API integration token

## Step 1: Get Notion API Token

1. **Create Notion Integration:**
   - Go to https://www.notion.so/my-integrations
   - Click "New integration"
   - Give it a name (e.g., "Context Sync MCP")
   - Select your workspace
   - Click "Submit"

2. **Copy Your API Token:**
   - After creation, you'll see an "Internal Integration Token"
   - Copy this token (starts with `secret_`)
   - **Keep this secure!** Never commit it to version control

3. **Share Pages with Integration:**
   - Open the Notion pages you want the AI to access
   - Click "..." (three dots) → "Add connections"
   - Select your integration name
   - The integration now has access to those pages

## Step 2: Install Notion MCP Server

The official Notion MCP server is maintained by Notion:

```bash
# Install globally (optional)
npm install -g @notionhq/mcp-server-notion

# Or use with npx (recommended)
npx @notionhq/mcp-server-notion
```

## Step 3: Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": [
        "-y",
        "@notionhq/mcp-server-notion"
      ],
      "env": {
        "NOTION_API_KEY": "secret_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**Windows Path:** `%APPDATA%\Claude\claude_desktop_config.json`

## Step 4: Configure Other AI Platforms

### Cursor IDE

Add to `.cursorrules` or Cursor settings:

```json
{
  "mcp": {
    "servers": {
      "notion": {
        "command": "npx",
        "args": ["-y", "@notionhq/mcp-server-notion"],
        "env": {
          "NOTION_API_KEY": "secret_YOUR_TOKEN_HERE"
        }
      }
    }
  }
}
```

### Continue.dev

Add to `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "notion",
      "command": "npx",
      "args": ["-y", "@notionhq/mcp-server-notion"],
      "env": {
        "NOTION_API_KEY": "secret_YOUR_TOKEN_HERE"
      }
    }
  ]
}
```

## Step 5: Test the Integration

Restart your AI assistant and try:

```
"Search my Notion workspace for documentation about API authentication"
```

```
"Create a new Notion page titled 'Project Plan' with sections for Timeline and Budget"
```

```
"Read the Notion page about deployment procedures and summarize it"
```

## Available Capabilities

Once configured, your AI can:

### Search & Read
- 🔍 Search all accessible Notion pages
- 📖 Read full page content (including blocks and databases)
- 🔗 Follow page relationships and links

### Create & Update
- ✍️ Create new pages with rich content
- 📝 Update existing page content
- 🏗️ Add blocks (text, headings, lists, code, etc.)
- 📊 Create and update database entries

### Organization
- 📁 Organize pages in hierarchies
- 🏷️ Add tags and properties
- 🔗 Create relationships between pages

## Security Best Practices

1. **Token Management:**
   ```bash
   # Use environment variables
   export NOTION_API_KEY="secret_YOUR_TOKEN_HERE"
   ```

2. **Minimal Access:**
   - Only share specific pages with the integration
   - Don't give access to sensitive workspaces

3. **Regular Review:**
   - Periodically check https://www.notion.so/my-integrations
   - Revoke access to unused pages
   - Rotate tokens if compromised

## Troubleshooting

### "Integration not found" Error
- Verify the token is correct
- Check the integration exists at notion.so/my-integrations

### "Page not accessible" Error
- Ensure the page is shared with your integration
- Check workspace permissions

### Server Won't Start
```bash
# Check Node version
node --version  # Should be 16+

# Test server manually
npx @notionhq/mcp-server-notion

# Check for errors in Claude logs
tail -f ~/Library/Logs/Claude/mcp*.log
```

## Example Use Cases

### 1. Documentation Management
```
"Create a troubleshooting guide in Notion for the authentication errors we discussed"
```

### 2. Meeting Notes
```
"Search my Notion for notes from the Q1 planning meeting"
```

### 3. Knowledge Base
```
"Update the API documentation page in Notion with the new endpoints we just created"
```

### 4. Project Planning
```
"Create a project roadmap page with milestones for Q2"
```

## Context Sync Integration

Context Sync now recognizes Notion as a platform:

```typescript
// Check if Notion is configured
const status = await mcp.call_tool("context-sync", 
  "get_platform_status", {});

// Switch to Notion for documentation work
const handoff = await mcp.call_tool("context-sync",
  "switch_platform", {
    fromPlatform: "cursor",
    toPlatform: "notion"
  });
```

## Further Resources

- **Official Docs:** https://github.com/makenotion/notion-mcp-server
- **Notion API:** https://developers.notion.com
- **MCP Spec:** https://modelcontextprotocol.io
- **Context Sync:** https://github.com/Intina47/context-sync

## Next Steps

1. ✅ Set up Notion integration token
2. ✅ Configure MCP server in your AI assistant
3. ✅ Share relevant pages with the integration
4. 🚀 Start using Notion with AI!

---

**Questions or Issues?**
- File an issue: https://github.com/Intina47/context-sync/issues
- Notion MCP issues: https://github.com/makenotion/notion-mcp-server/issues
