# Troubleshooting Guide

## Common Issues

### Setup Script Fails

**Symptom:** `node setup.js` exits with error

**Solutions:**
1. Check Node.js version: `node --version` (need 18+)
2. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
3. Try manual setup (see README)

---

### "Server Disconnected" in Claude

**Symptom:** Claude shows "context-sync failed" in settings

**Debug steps:**

1. **Verify build exists:**
   ```bash
   ls dist/index.js
   # Should show the file
   ```

2. **Test server manually:**
   ```bash
   node dist/index.js
   # Should show: "Context Sync MCP server running on stdio"
   # Press Ctrl+C to stop
   ```

3. **Check config path:**
   - Mac: `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json`
   - Windows: `type %APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `cat ~/.config/Claude/claude_desktop_config.json`
   
   Path should match your actual dist/index.js location

4. **Check Claude logs:**
   - Mac: `~/Library/Logs/Claude/`
   - Windows: `%LOCALAPPDATA%\Claude\logs\`
   - Linux: `~/.local/state/Claude/logs/`
   
   Look for `mcp-server-context-sync.log`

**Common fixes:**
- Wrong path in config → Update to absolute path
- Path has spaces → Wrap in quotes
- Windows: Use `C:\\` or `C:/` format, not `/c/`

---

### "No Active Project" Error

**Symptom:** Claude says "No active project" when you ask about context

**Solution:**
Initialize a project first:
```
You: Initialize a project called "my-app"
```

Or check if you have projects:
```bash
sqlite3 ~/.context-sync/data.db "SELECT * FROM projects;"
```

---

### Context Not Loading in New Chats

**Symptom:** Open new chat, Claude doesn't remember project

**Debug:**
1. Check project is initialized: Ask "What projects do I have?"
2. Check MCP prompts are working: Claude should auto-inject context
3. Try explicitly: "Get my project context"

**If still not working:**
- Rebuild: `npm run build`
- Restart Claude Desktop completely
- Check version is 0.1.0+: Look in package.json

---

### Database Errors

**Symptom:** SQLite errors in logs

**Solutions:**

1. **Corrupted database:**
   ```bash
   # Backup first
   cp ~/.context-sync/data.db ~/.context-sync/data.db.backup
   
   # Delete and recreate
   rm ~/.context-sync/data.db
   # Restart Claude, database will be recreated
   ```

2. **Permission issues:**
   ```bash
   # Check permissions
   ls -la ~/.context-sync/
   
   # Fix permissions
   chmod 755 ~/.context-sync
   chmod 644 ~/.context-sync/data.db
   ```

---

### Windows Path Issues

**Symptom:** Setup works but Claude can't connect (Windows only)

**Solution:**
Paths must use Windows format in config:

**❌ Wrong:**
```json
"/c/Users/name/context-sync/dist/index.js"
```

**✅ Correct:**
```json
"C:\\Users\\name\\context-sync\\dist\\index.js"
```

Or use forward slashes:
```json
"C:/Users/name/context-sync/dist/index.js"
```

See [WINDOWS.md](WINDOWS.md) for detailed Windows setup.

---

### Build Fails

**Symptom:** `npm run build` exits with TypeScript errors

**Solutions:**

1. **Clean build:**
   ```bash
   rm -rf dist
   rm -rf node_modules
   npm install
   npm run build
   ```

2. **Check TypeScript version:**
   ```bash
   npx tsc --version
   # Should be 5.3.3 or higher
   ```

3. **Node version mismatch:**
   ```bash
   node --version
   # Must be 18 or higher
   ```

---

### Multiple Projects Confusion

**Symptom:** Claude uses wrong project context

**Solution:**

Check current project:
```
You: What is my current active project?
```

Switch projects:
```
You: Initialize project "other-app"
```

List all projects:
```bash
sqlite3 ~/.context-sync/data.db "SELECT id, name, is_current FROM projects;"
```

---

### Performance Issues

**Symptom:** Claude responses are slow

**Causes:**
- Too much context being loaded
- Large database file
- Many old conversations

**Solutions:**

1. **Check database size:**
   ```bash
   ls -lh ~/.context-sync/data.db
   # If > 100MB, might need cleanup
   ```

2. **Limit context in code** (advanced):
   Edit `src/storage.ts` - reduce `limit` in `getRecentConversations`

3. **Start fresh:**
   ```bash
   mv ~/.context-sync/data.db ~/.context-sync/data.db.old
   # Creates new database
   ```

---

### Prompts Not Auto-Injecting

**Symptom:** Context doesn't load automatically in new chats

**Check:**

1. **Verify prompts capability:**
   Look in `src/server.ts` - should have:
   ```typescript
   capabilities: {
     tools: {},
     prompts: {}, // This line
   }
   ```

2. **Check MCP version:**
   ```bash
   npm list @modelcontextprotocol/sdk
   # Should be 0.5.0+
   ```

3. **Rebuild:**
   ```bash
   npm run build
   ```

---

## Platform-Specific Issues

### macOS

**Symptom:** Permission denied errors

**Solution:**
```bash
# Allow Terminal/Claude to access files
System Preferences → Security & Privacy → Files and Folders
```

**Symptom:** "command not found: node"

**Solution:**
```bash
# Add Node to PATH
export PATH="/usr/local/bin:$PATH"
# Or reinstall Node from nodejs.org
```

---

### Windows

**Symptom:** PowerShell execution policy error

**Solution:**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**Symptom:** Paths with spaces don't work

**Solution:**
Use quotes in config:
```json
"C:/Program Files/context-sync/dist/index.js"
```

---

### Linux

**Symptom:** Claude Desktop not found

**Solution:**
Linux isn't officially supported by Claude Desktop yet. Check:
```bash
which claude
```

---

## Advanced Debugging

### Enable Verbose Logging

Add to `src/index.ts`:
```typescript
process.env.DEBUG = '*';
```

Rebuild and check logs.

### Inspect Database

```bash
sqlite3 ~/.context-sync/data.db

# List all tables
.tables

# Check projects
SELECT * FROM projects;

# Check recent decisions
SELECT * FROM decisions ORDER BY timestamp DESC LIMIT 10;

# Check conversation count
SELECT COUNT(*) FROM conversations;

# Exit
.quit
```

### Test MCP Server Directly

```bash
# Install MCP inspector
npm install -g @modelcontextprotocol/inspector

# Run inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens web UI to test tools/prompts directly.

---

## Still Having Issues?

### Before Opening an Issue

1. Check if issue already exists: [GitHub Issues](https://github.com/Intina47/context-sync/issues)
2. Try all relevant solutions above
3. Collect debug info (see below)

### Debug Info to Include

When opening an issue, include:

```bash
# System info
node --version
npm --version
# Your OS and version

# Context Sync info
cat package.json | grep version

# Build status
ls -la dist/

# Config content (remove sensitive paths)
# Mac: cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Windows: type %APPDATA%\Claude\claude_desktop_config.json

# Recent logs (last 50 lines)
# Mac: tail -50 ~/Library/Logs/Claude/mcp-server-context-sync.log
# Windows: Get-Content $env:LOCALAPPDATA\Claude\logs\mcp-server-context-sync.log -Tail 50
```

### Get Help

- **GitHub Issues:** [Report bugs](https://github.com/Intina47/context-sync/issues)
- **GitHub Discussions:** [Ask questions](https://github.com/Intina47/context-sync/discussions)
- **Community:** Check if others had the same issue

---

## Emergency Reset

If everything is broken:

```bash
# 1. Stop Claude Desktop

# 2. Backup your data (optional)
cp -r ~/.context-sync ~/.context-sync.backup

# 3. Remove Context Sync
rm -rf ~/.context-sync

# 4. Remove from Claude config
# Edit the config file and remove the context-sync section

# 5. Fresh install
cd context-sync
rm -rf node_modules dist
npm install
npm run build
node setup.js

# 6. Restart Claude Desktop
```

---

## Quick Fixes Checklist

Try these in order:

- [ ] Restart Claude Desktop
- [ ] Rebuild: `npm run build`
- [ ] Test manually: `node dist/index.js`
- [ ] Check config path is correct
- [ ] Verify Node.js 18+
- [ ] Delete and recreate database
- [ ] Fresh install

Usually one of these fixes it! 🎉