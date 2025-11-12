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

// Get version from package.json
function getVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return '0.6.1'; // Fallback version
  }
}

// Detect if this is a global install
const isGlobalInstall = process.env.npm_config_global === 'true' || 
                        process.env.npm_config_location === 'global';

const version = getVersion();
log(colors.cyan + colors.bold, `\n🧠 Context Sync MCP Server v${version}\n`);

if (!isGlobalInstall) {
  log(colors.yellow, '⚠️  Detected local installation.');
  log(colors.yellow, 'For automatic setup, install globally:\n');
  log(colors.reset, '  npm install -g @context-sync/server\n');
  log(colors.gray, 'Skipping automatic configuration.\n');
  process.exit(0);
}

// Only auto-configure if globally installed
log(colors.green, '✅ Global installation detected');
log(colors.gray, 'Setting up AI platform configurations...\n');

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

log(colors.green, `✅ Package found: ${packagePath}\n`);

// Track successful configurations
let configurationsCompleted = [];

// ============================================================================
// CLAUDE DESKTOP CONFIGURATION
// ============================================================================
log(colors.cyan + colors.bold, '🤖 Configuring Claude Desktop...\n');

const platform = os.platform();
let claudeConfigPath;

if (platform === 'darwin') {
  claudeConfigPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
} else if (platform === 'win32') {
  claudeConfigPath = path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
} else {
  claudeConfigPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

log(colors.gray, `📁 Config path: ${claudeConfigPath}`);

// Setup Claude Desktop
const claudeResult = setupClaudeDesktop(claudeConfigPath, packagePath);
if (claudeResult.success) {
  configurationsCompleted.push('Claude Desktop');
  log(colors.green, '✅ Claude Desktop configured successfully!\n');
} else {
  log(colors.yellow, '⚠️  Claude Desktop configuration skipped');
  log(colors.gray, claudeResult.message + '\n');
}

// ============================================================================
// VS CODE CONFIGURATION (GitHub Copilot)
// ============================================================================
log(colors.cyan + colors.bold, '💻 Configuring VS Code (GitHub Copilot)...\n');

const vscodeMcpPath = getVSCodeMcpPath();
log(colors.gray, `📁 MCP config path: ${vscodeMcpPath}`);

const vscodeResult = setupVSCode(vscodeMcpPath, packagePath);
if (vscodeResult.success) {
  configurationsCompleted.push('VS Code');
  log(colors.green, '✅ VS Code configured successfully!\n');
} else {
  log(colors.yellow, '⚠️  VS Code configuration skipped');
  log(colors.gray, vscodeResult.message + '\n');
}

// ============================================================================
// FINAL SUCCESS MESSAGE
// ============================================================================
if (configurationsCompleted.length === 0) {
  log(colors.red, '❌ No platforms were configured automatically.');
  log(colors.yellow, '\nPlease configure manually:\n');
  printManualInstructions(packagePath);
  process.exit(1);
}

log(colors.green + colors.bold, `\n✅ Context Sync installed successfully!\n`);
log(colors.reset, `Configured platforms: ${colors.cyan}${configurationsCompleted.join(', ')}${colors.reset}\n`);
log(colors.reset, 'Next steps:\n');

if (configurationsCompleted.includes('Claude Desktop')) {
  log(colors.cyan, '📱 Claude Desktop:');
  log(colors.reset, '   1. Restart Claude Desktop completely');
  log(colors.reset, '   2. Open a new chat');
  log(colors.reset, '   3. Type: ' + colors.gray + '"help context-sync"' + colors.reset);
  log(colors.reset, '   4. Follow the guided setup!\n');
}

if (configurationsCompleted.includes('VS Code')) {
  log(colors.cyan, '💻 VS Code (GitHub Copilot):');
  log(colors.reset, '   1. Restart VS Code completely');
  log(colors.reset, '   2. Open Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I)');
  log(colors.reset, '   3. Switch to Agent mode');
  log(colors.reset, '   4. Look for context-sync in Tools list');
  log(colors.reset, '   5. Start syncing context!\n');
}

log(colors.reset, '📚 Documentation: ' + colors.cyan + 'https://github.com/Intina47/context-sync');
log(colors.reset, '💬 Issues: ' + colors.cyan + 'https://github.com/Intina47/context-sync/issues');
log(colors.reset, '\n🎉 Happy coding!\n');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setupClaudeDesktop(configPath, packagePath) {
  try {
    // Check if config directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      log(colors.gray, '   Creating directory...');
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      log(colors.gray, '   Creating new configuration file...');
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }, null, 2), 'utf8');
    }

    // Read existing config
    log(colors.gray, '   Reading configuration...');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Check if already configured
    if (config.mcpServers['context-sync']) {
      return {
        success: false,
        message: 'Already configured. Current config:\n' + JSON.stringify(config.mcpServers['context-sync'], null, 2)
      };
    }

    // Add Context Sync configuration
    log(colors.gray, '   Adding Context Sync to configuration...');
    config.mcpServers['context-sync'] = {
      command: 'node',
      args: [packagePath]
    };

    // Backup and write
    const backupPath = configPath + '.backup';
    fs.copyFileSync(configPath, backupPath);
    log(colors.gray, `   💾 Backup created: ${backupPath}`);
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

function getVSCodeMcpPath() {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    // macOS - User-level MCP config
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  } else if (platform === 'win32') {
    // Windows - User-level MCP config  
    return path.join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json');
  } else {
    // Linux - User-level MCP config
    return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
  }
}

function setupVSCode(mcpPath, packagePath) {
  try {
    // Check if VS Code directory exists
    const mcpDir = path.dirname(mcpPath);
    if (!fs.existsSync(mcpDir)) {
      log(colors.gray, '   Creating MCP config directory...');
      fs.mkdirSync(mcpDir, { recursive: true });
    }

    // Read existing MCP config or create new one
    log(colors.gray, '   Reading MCP configuration...');
    let mcpConfig = {
      servers: {},
      inputs: []
    };
    
    if (fs.existsSync(mcpPath)) {
      const mcpContent = fs.readFileSync(mcpPath, 'utf8');
      try {
        mcpConfig = JSON.parse(mcpContent);
      } catch (parseError) {
        log(colors.gray, '   ⚠️  Could not parse existing MCP config, creating new one');
        mcpConfig = {
          servers: {},
          inputs: []
        };
      }
    } else {
      log(colors.gray, '   Creating new MCP config file...');
    }

    // Initialize servers if it doesn't exist
    if (!mcpConfig.servers) {
      mcpConfig.servers = {};
    }

    // Check if already configured
    if (mcpConfig.servers['context-sync']) {
      return {
        success: false,
        message: 'Already configured in VS Code MCP settings'
      };
    }

    // Add Context Sync configuration
    log(colors.gray, '   Adding Context Sync to MCP configuration...');
    mcpConfig.servers['context-sync'] = {
      command: 'node',
      args: [packagePath],
      type: 'stdio'
    };

    // Ensure inputs array exists
    if (!mcpConfig.inputs) {
      mcpConfig.inputs = [];
    }

    // Backup existing config
    if (fs.existsSync(mcpPath)) {
      const backupPath = mcpPath + '.backup';
      fs.copyFileSync(mcpPath, backupPath);
      log(colors.gray, `   💾 Backup created: ${backupPath}`);
    }

    // Write updated config
    fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

function printManualInstructions(pkgPath) {
  log(colors.cyan + colors.bold, '\n📝 Manual Configuration Instructions:\n');
  
  log(colors.cyan, '🤖 Claude Desktop:');
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
  
  log(colors.cyan, '💻 VS Code (GitHub Copilot):');
  log(colors.reset, '1. Create file: ~/.vscode/mcp.json (macOS/Linux)');
  log(colors.reset, '   or %APPDATA%\\Code\\User\\globalStorage\\mcp.json (Windows)');
  log(colors.reset, '2. Add this configuration:\n');
  log(colors.gray, '{');
  log(colors.gray, '  "servers": {');
  log(colors.gray, '    "context-sync": {');
  log(colors.gray, '      "command": "node",');
  log(colors.gray, `      "args": ["${pkgPath || '/path/to/context-sync/dist/index.js'}"],`);
  log(colors.gray, '      "type": "stdio"');
  log(colors.gray, '    }');
  log(colors.gray, '  },');
  log(colors.gray, '  "inputs": []');
  log(colors.gray, '}\n');
}
