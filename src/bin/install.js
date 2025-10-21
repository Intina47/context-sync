#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Simple colored output without dependencies (for initial install)
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(color + message + colors.reset);
}

// Detect if this is a global install
const isGlobalInstall = process.env.npm_config_global === 'true' || 
                        process.env.npm_config_location === 'global';

log(colors.cyan + colors.bold, '\n🧠 Context Sync MCP Server v0.3.0\n');

if (!isGlobalInstall) {
  log(colors.yellow, '⚠️  Detected local installation.');
  log(colors.yellow, 'For automatic setup, install globally:\n');
  log(colors.reset, '  npm install -g @context-sync/server\n');
  log(colors.gray, 'Skipping automatic Claude Desktop configuration.\n');
  process.exit(0);
}

// Only auto-configure if globally installed
log(colors.green, '✅ Global installation detected');
log(colors.gray, 'Setting up Claude Desktop configuration...\n');

// Detect OS and find Claude config
const platform = os.platform();
let configPath;

if (platform === 'darwin') {
  // macOS
  configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
} else if (platform === 'win32') {
  // Windows
  configPath = path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
} else {
  // Linux
  configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

log(colors.gray, `📁 Config path: ${configPath}`);

// Check if config directory exists
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
  log(colors.yellow, '\n⚠️  Claude Desktop directory not found.');
  log(colors.yellow, 'Creating directory...\n');
  try {
    fs.mkdirSync(configDir, { recursive: true });
    log(colors.green, '✅ Directory created');
  } catch (error) {
    log(colors.red, '❌ Could not create directory');
    log(colors.gray, error.message);
    printManualInstructions();
    process.exit(1);
  }
}

// Check if config file exists
if (!fs.existsSync(configPath)) {
  log(colors.yellow, '\n⚠️  Claude Desktop config file not found.');
  log(colors.yellow, 'Creating new configuration...\n');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }, null, 2), 'utf8');
    log(colors.green, '✅ Configuration file created');
  } catch (error) {
    log(colors.red, '❌ Could not create config file');
    printManualInstructions();
    process.exit(1);
  }
}

// Read existing config
log(colors.gray, '📖 Reading configuration...');
let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  log(colors.red, '❌ Error reading configuration file');
  log(colors.gray, error.message);
  printManualInstructions();
  process.exit(1);
}

if (!config.mcpServers) {
  config.mcpServers = {};
}

// Check if already configured
if (config.mcpServers['context-sync']) {
  log(colors.yellow, '\n⚠️  Context Sync is already configured in Claude Desktop.');
  log(colors.reset, '\nCurrent configuration:');
  log(colors.gray, JSON.stringify(config.mcpServers['context-sync'], null, 2));
  log(colors.reset, '\nTo update, run: context-sync install --force\n');
  process.exit(0);
}

// Find the globally installed package path
log(colors.gray, '🔍 Locating installed package...');
let packagePath;
try {
  const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  packagePath = path.join(npmRoot, '@context-sync', 'server', 'dist', 'index.js');
  
  // Fallback for non-scoped package name
  if (!fs.existsSync(packagePath)) {
    packagePath = path.join(npmRoot, 'context-sync-mcp', 'dist', 'index.js');
  }
} catch (error) {
  log(colors.red, '❌ Could not locate package');
  log(colors.gray, error.message);
  printManualInstructions();
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  log(colors.red, `❌ Package not found at: ${packagePath}`);
  printManualInstructions();
  process.exit(1);
}

log(colors.green, `✅ Package found: ${packagePath}`);

// Add Context Sync configuration
log(colors.gray, '⚙️  Adding Context Sync to configuration...');

config.mcpServers['context-sync'] = {
  command: 'node',
  args: [packagePath]
};

// Write updated config
try {
  // Backup existing config
  const backupPath = configPath + '.backup';
  fs.copyFileSync(configPath, backupPath);
  log(colors.gray, `💾 Backup created: ${backupPath}`);
  
  // Write new config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  log(colors.green, '✅ Configuration updated successfully!');
} catch (error) {
  log(colors.red, '\n❌ Error writing configuration file:');
  log(colors.red, error.message);
  log(colors.yellow, '\nTry running with elevated privileges, or configure manually:\n');
  printManualInstructions(packagePath);
  process.exit(1);
}

// Success!
log(colors.green + colors.bold, '\n✅ Context Sync installed successfully!\n');
log(colors.reset, 'Next steps:\n');
log(colors.cyan, '1. ' + colors.reset + 'Restart Claude Desktop completely');
log(colors.cyan, '2. ' + colors.reset + 'Open a new chat');
log(colors.cyan, '3. ' + colors.reset + 'Try: ' + colors.gray + '"Set workspace to /path/to/your/project"');
log(colors.reset, '\n📚 Documentation: ' + colors.cyan + 'https://github.com/Intina47/context-sync');
log(colors.reset, '💬 Issues: ' + colors.cyan + 'https://github.com/Intina47/context-sync/issues');
log(colors.reset, '\n🎉 Happy coding!\n');

function printManualInstructions(pkgPath) {
  log(colors.reset, '\n📝 Manual Configuration Instructions:\n');
  log(colors.reset, '1. Open Claude Desktop');
  log(colors.reset, '2. Go to Settings → Developer → MCP Servers');
  log(colors.reset, '3. Add this configuration:\n');
  log(colors.gray, '{');
  log(colors.gray, '  "mcpServers": {');
  log(colors.gray, '    "context-sync": {');
  log(colors.gray, '      "command": "node",');
  log(colors.gray, `      "args": ["${pkgPath || '/path/to/context-sync/dist/index.js'}"]`);
  log(colors.gray, '    }');
  log(colors.gray, '  }');
  log(colors.gray, '}\n');
  log(colors.reset, 'Config file location:');
  log(colors.gray, configPath + '\n');
}