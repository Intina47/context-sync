#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const PlatformAutoConfigurator = require('./auto-configurator.cjs');
const readlineSync = require('readline-sync');

// Simple colored output without dependencies (for initial install)
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  white: '\x1b[37m'
};

function log(color, message) {
  // Use console.error to ensure output is visible during npm install
  console.error(color + message + colors.reset);
}

const CONFIG_DIR = path.join(os.homedir(), '.context-sync');
const STATUS_FILE = path.join(CONFIG_DIR, 'install-status.json');

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

// ALWAYS show banner - use process.stdout.write to bypass npm suppression
process.stdout.write('\n' + '='.repeat(80) + '\n');
process.stdout.write('\x1b[36m\x1b[1m Context Sync MCP Server v' + version + '\x1b[0m\n');
process.stdout.write('='.repeat(80) + '\n\n');

if (!isGlobalInstall) {
  log(colors.yellow, '  Detected local installation.');
  log(colors.yellow, 'For automatic setup, install globally:\n');
  log(colors.reset, '  npm install -g @context-sync/server\n');
  log(colors.gray, 'Skipping automatic configuration.\n');
  
  // Still show Notion message even for local installs
  log(colors.cyan + colors.bold, ' NEW: Notion Integration Available!\n');
  log(colors.gray, ' Sync your AI context directly to Notion:\n');
  log(colors.green + colors.bold, ' To set up, run:\n');
  log(colors.cyan + colors.bold, '   npx context-sync-setup\n');
  
  process.exit(0);
}

// Only auto-configure if globally installed
log(colors.green, ' Global installation detected');
log(colors.gray, 'Setting up AI platform configurations...\n');

// Find the globally installed package path
log(colors.gray, ' Locating installed package...');
let packagePath;
try {
  const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  packagePath = path.join(npmRoot, '@context-sync', 'server', 'dist', 'index.js');
  
  // Fallback for non-scoped package name
  if (!fs.existsSync(packagePath)) {
    packagePath = path.join(npmRoot, 'context-sync-mcp', 'dist', 'index.js');
  }
} catch (error) {
  log(colors.red, ' Could not locate package');
  log(colors.gray, error.message);
  printManualInstructions();
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  log(colors.red, ` Package not found at: ${packagePath}`);
  printManualInstructions();
  process.exit(1);
}

log(colors.green, ` Package found: ${packagePath}\n`);

// ============================================================================
// UNIVERSAL AI PLATFORM AUTO-CONFIGURATION
// ============================================================================
log(colors.cyan + colors.bold, ' Universal AI Platform Auto-Configuration\n');
log(colors.gray, 'Context Sync will now automatically detect and configure all installed AI platforms...\n');

// ============================================================================
// SETUP WIZARD INTEGRATION
// ============================================================================
async function runSetupWizard() {
  try {
    // Check if Notion is already configured
    const configPath = path.join(os.homedir(), '.context-sync', 'config.json');
    let skipWizard = false;
    
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.notion?.token && config.notion?.configuredAt) {
          log(colors.green, '\n Notion integration already configured');
          log(colors.gray, '   Configured at: ' + new Date(config.notion.configuredAt).toLocaleString());
          if (config.notion.defaultParentPageId) {
            log(colors.gray, '   Default parent page: Set');
          }
          log(colors.gray, '\n To reconfigure Notion integration:');
          log(colors.gray, '   Edit: ' + configPath);
          log(colors.gray, '   Or reinstall: npm install -g @context-sync/server\n');
          skipWizard = true;
        }
      } catch (error) {
        // If we can't read config, proceed with wizard
        log(colors.gray, '  Could not read existing config, running setup wizard...\n');
      }
    }
    
    if (skipWizard) {
      return;
    }
    
    // Show optional Notion integration info - ALWAYS visible with prominent formatting
    console.error('\n' + ''.repeat(80));
    log(colors.cyan + colors.bold, ' NEW: Notion Integration Available!');
    console.error(''.repeat(80));
    log(colors.gray, '\n Context Sync can now sync your AI context directly to Notion:\n');
    
    log(colors.white, '    Generate feature docs and export to Notion');
    log(colors.white, '    Pull project specs from Notion for AI to implement');
    log(colors.white, '    Export architecture decisions as ADRs');
    log(colors.white, '    Create beautifully formatted pages automatically\n');
    
    log(colors.green + colors.bold, ' To set up Notion integration, run:\n');
    log(colors.cyan + colors.bold, '   context-sync-setup\n');
    log(colors.gray, '   (or: npx context-sync-setup)\n');
    
    log(colors.gray, '   The interactive wizard will guide you through connecting Notion.');
    console.error(''.repeat(80) + '\n');
    
  } catch (error) {
    log(colors.yellow, '\n  Setup wizard encountered an issue.');
    log(colors.gray, 'You can run it manually later with: npm run setup\n');
    log(colors.gray, `Details: ${error.message}\n`);
  }
}

function writeInstallStatus(status) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch (error) {
    // Best-effort only
  }
}

function buildInstallStatus(outcome, results, errorMessage) {
  const needsManual =
    outcome !== 'success' ||
    (results && (results.errors?.length > 0 || results.configured?.length === 0));

  return {
    version,
    timestamp: new Date().toISOString(),
    outcome,
    needsManual,
    results: results || null,
    error: errorMessage || null
  };
}

function maybePromptManualConfig(packagePath) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    log(colors.yellow, 'Manual configuration may be required.');
    log(colors.gray, `Details saved to: ${STATUS_FILE}`);
    return;
  }

  const showManual = readlineSync.keyInYNStrict('Would you like manual configuration steps now?');
  if (showManual) {
    printManualInstructions(packagePath);
  }
}

// Use our new auto-configuration system
async function runAutoConfiguration() {
  const autoConfigurator = new PlatformAutoConfigurator(packagePath, false);
  
  try {
    const results = await autoConfigurator.configureAllPlatforms();
    // Generate and display report
    const report = autoConfigurator.generateReport();
    console.error(report);

    const status = buildInstallStatus('success', results);
    writeInstallStatus(status);

    // Show platform-specific next steps
    if (results.configured.length > 0) {
      log(colors.cyan + colors.bold, ' Platform-Specific Instructions:\n');

      results.configured.forEach(platformId => {
        switch (platformId) {
          case 'claude':
            log(colors.cyan, ' Claude Desktop:');
            log(colors.reset, '   1. Restart Claude Desktop completely');
            log(colors.reset, '   2. Open a new chat');
            log(colors.reset, '   3. Type: ' + colors.gray + '"help context-sync"' + colors.reset);
            log(colors.reset, '   4. Follow the guided setup!\n');
            break;

          case 'cursor':
            log(colors.cyan, '  Cursor IDE:');
            log(colors.reset, '   1. Restart Cursor IDE');
            log(colors.reset, '   2. Open Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I)');
            log(colors.reset, '   3. Look for context-sync in Tools list');
            log(colors.reset, '   4. Start syncing context!\n');
            break;

          case 'copilot':
            log(colors.cyan, ' VS Code (GitHub Copilot):');
            log(colors.reset, '   1. Restart VS Code completely');
            log(colors.reset, '   2. Open Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I)');
            log(colors.reset, '   3. Switch to Agent mode');
            log(colors.reset, '   4. Look for context-sync in Tools list');
            log(colors.reset, '   5. Start syncing context!\n');
            break;

          case 'continue':
            log(colors.cyan, ' Continue.dev:');
            log(colors.reset, '   1. Restart VS Code');
            log(colors.reset, '   2. Open Continue chat panel');
            log(colors.reset, '   3. Context Sync should be available as MCP tool');
            log(colors.reset, '   4. Try: "help context-sync"\n');
            break;

          default:
            log(colors.cyan, ` ${platformId}:`);
            log(colors.reset, '   1. Restart the application');
            log(colors.reset, '   2. Look for context-sync in MCP/Tools menu');
            log(colors.reset, '   3. Try: "help context-sync"\n');
            break;
        }
      });

      log(colors.green + colors.bold, ' Context Sync is now your universal AI memory layer!\n');
      log(colors.reset, ' All configured platforms share the same persistent context and memory.');
      log(colors.reset, ' Switch between platforms seamlessly with full context preservation.\n');
    } else {
      log(colors.yellow, '  No AI platforms were auto-configured.');
      log(colors.reset, '\nTo get started:');
      log(colors.reset, '1. Install an AI platform that supports MCP (Claude Desktop, Cursor, VS Code + Copilot)');
      log(colors.reset, '2. Re-run: npm install -g @context-sync/server');
      log(colors.reset, '3. Auto-configuration will detect and configure it automatically!\n');
      
      printManualInstructions(packagePath);
    }

    if (status.needsManual) {
      maybePromptManualConfig(packagePath);
    }

    // Run the setup wizard for additional integrations (Notion, etc.)
    await runSetupWizard();

    log(colors.reset, ' Documentation: ' + colors.cyan + 'https://github.com/Intina47/context-sync');
    log(colors.reset, ' Issues: ' + colors.cyan + 'https://github.com/Intina47/context-sync/issues');
    log(colors.reset, '\n Happy coding with universal AI context!\n');

  } catch (error) {
    log(colors.red, ' Auto-configuration failed:');
    log(colors.gray, error.message);
    log(colors.yellow, '\nFalling back to manual configuration...\n');
    printManualInstructions(packagePath);
    writeInstallStatus(buildInstallStatus('error', null, error.message));
    maybePromptManualConfig(packagePath);
    process.exit(1);
  }
}

// Run the auto-configuration
runAutoConfiguration();

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
    log(colors.gray, `    Backup created: ${backupPath}`);
    
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
        log(colors.gray, '     Could not parse existing MCP config, creating new one');
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
      log(colors.gray, `    Backup created: ${backupPath}`);
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
  log(colors.cyan + colors.bold, '\n Manual Configuration Instructions:\n');
  
  log(colors.cyan, ' Claude Desktop:');
  log(colors.reset, '1. Open Claude Desktop');
  log(colors.reset, '2. Go to Settings  Developer  MCP Servers');
  log(colors.reset, '3. Add this configuration:\n');
  log(colors.gray, '{');
  log(colors.gray, '  "mcpServers": {');
  log(colors.gray, '    "context-sync": {');
  log(colors.gray, '      "command": "node",');
  log(colors.gray, `      "args": ["${pkgPath || '/path/to/context-sync/dist/index.js'}"]`);
  log(colors.gray, '    }');
  log(colors.gray, '  }');
  log(colors.gray, '}\n');
  
  log(colors.cyan, ' VS Code (GitHub Copilot):');
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


