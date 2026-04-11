# Notion Integration Guide

## Overview
This guide shows you how to connect Context Sync directly to Notion using the official Notion API. You’ll be able to read and write Notion pages, search your workspace, and manage documentation—no separate MCP server required!
## Prerequisites

- Node.js 18+ installed
- A Notion account with workspace access
- Notion API integration token
## Step 1: Get Your Notion API Token
   go to -> https://www.notion.so/profile/integrations
1. **Create a Notion Integration:**
  - Give it a name (e.g., "Context Sync")
  - Select your workspace
  - Click "Submit"
2. **Share Pages access with Your Integration:**
  - Click access under the newly created intergration.

3. **Copy your Integration Secret**
   - The secrete starts with ntn_ or secret_
  
## Step 2: Install Context Sync

```bash
npm install -g @context-sync/server
```
## Step 3: Run the Setup Wizard

Just run:
```bash
context-sync-setup
```
The wizard will prompt you for your Notion API token and handle the rest!
## Step 4: Start Using Notion with Context Sync

You’re all set! Context Sync will connect directly to Notion using your API token. No extra server or config needed.
## Step 5: Test the Integration

Try searching, reading, or creating pages in Notion using Context Sync’s tools and commands. If you run into any issues, check your API token and make sure the pages are shared with your integration.
## Available Capabilities

Once configured, you can use the `notion` tool with two actions:
- **search** — Search all accessible Notion pages by keyword
- **read** — Read full page content (including blocks and databases)

Note: The Notion integration is read-only. Write operations (creating pages, updating content) are not currently exposed through the MCP tool interface.
## Security Best Practices

1. **Token Management:**
  - Keep your API token secure. Never commit it to version control.
2. **Minimal Access:**
  - Only share specific pages with the integration.
3. **Regular Review:**
  - Periodically check https://www.notion.so/my-integrations
  - Revoke access to unused pages
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
```
## Example Use Cases

### 1. Documentation Lookup
- "Search my Notion for notes from the Q1 planning meeting"
- "Read the API documentation page in Notion"
- "Find the project roadmap page in Notion"
## Context Sync Integration

Context Sync can search and read Notion docs directly.
- **Notion API:** https://developers.notion.com
- **Context Sync:** https://github.com/Intina47/context-sync
## Next Steps

1. ✅ Set up Notion integration token
2. ✅ Share relevant pages with the integration
3. 🚀 Start using Notion with Context Sync!
