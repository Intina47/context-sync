#!/usr/bin/env node

/**
 * Universal setup script for Context Sync
 * Works on Windows, macOS, and Linux
 * Run with: node setup.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logStep(message) {
  console.log(colors.cyan + message + colors.reset);
}

function logSuccess(message) {
  console.log(colors.green + '✓ ' + message + colors.reset);
}

function logWarning(message) {
  console.log(colors.yellow + '⚠️  ' + message + colors.reset);
}

function logError(message) {
  console.log(colors.red + '❌ ' + message + colors.reset);
}

// Detect operating system
function detectOS() {
  const platform = os.platform();
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

// Get Claude Desktop config path
function getClaudeConfigPath(osType) {
  const homeDir = os.homedir();
  
  if (osType === 'mac') {
    return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (osType === 'windows') {
    return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else if (osType === 'linux') {
    return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
  }
  
  return null;
}

// Check if command exists
function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Run command and return output
function runCommand(command, description) {
  try {
    logStep(description);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    logError(`Failed: ${description}`);
    return false;
  }
}

// Main setup function
async function setup() {
  log('🚀 Context Sync Setup', 'cyan');
  log('='.repeat(50), 'cyan');
  console.log('');

  // Detect OS
  const osType = detectOS();
  log(`Detected OS: ${osType}`);
  console.log('');

  // Check Node.js
  if (!commandExists('node')) {
    logError('Node.js is not installed');
    log('Please install Node.js 18+ from https://nodejs.org/');
    process.exit(1);
  }

  const nodeVersion = execSync('node -v').toString().trim();
  logSuccess(`Node.js ${nodeVersion} found`);

  // Check package manager
  const hasYarn = commandExists('yarn');
  const hasNpm = commandExists('npm');
  
  if (!hasYarn && !hasNpm) {
    logError('No package manager found');
    process.exit(1);
  }

  const packageManager = hasYarn ? 'yarn' : 'npm';
  logSuccess(`${packageManager} found`);
  console.log('');

  // Install dependencies
  if (!runCommand(`${packageManager} install`, '📦 Installing dependencies...')) {
    process.exit(1);
  }
  logSuccess('Dependencies installed');
  console.log('');

  // Build project
  if (!runCommand(`${packageManager} run build`, '🔨 Building project...')) {
    process.exit(1);
  }
  logSuccess('Project built successfully');
  console.log('');

  // Get path to built server
  const projectDir = process.cwd();
  const indexPath = path.join(projectDir, 'dist', 'index.js');

  // Verify build output exists
  if (!fs.existsSync(indexPath)) {
    logError(`Build output not found at: ${indexPath}`);
    process.exit(1);
  }

  log(`📍 MCP Server path: ${indexPath}`, 'cyan');
  console.log('');

  // Configure Claude Desktop
  logStep('⚙️  Configuring Claude Desktop...');
  
  const claudeConfigPath = getClaudeConfigPath(osType);
  
  if (!claudeConfigPath) {
    logError('Could not determine Claude Desktop config path');
    process.exit(1);
  }

  log(`Config path: ${claudeConfigPath}`);

  // Create config directory if it doesn't exist
  const configDir = path.dirname(claudeConfigPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    log('Created config directory');
  }

  // Prepare config JSON
  const config = {
    mcpServers: {
      'context-sync': {
        command: 'node',
        args: [indexPath]
      }
    }
  };

  // Check if config exists and merge
  if (fs.existsSync(claudeConfigPath)) {
    try {
      const existingConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
      
      if (existingConfig.mcpServers && existingConfig.mcpServers['context-sync']) {
        logWarning('context-sync already configured');
        
        // Ask user if they want to update
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise(resolve => {
          readline.question('Update configuration? (y/N): ', resolve);
        });
        
        readline.close();

        if (answer.toLowerCase() !== 'y') {
          log('Skipping configuration update');
          console.log('');
          printNextSteps(osType);
          return;
        }
      }

      // Merge configs
      existingConfig.mcpServers = existingConfig.mcpServers || {};
      existingConfig.mcpServers['context-sync'] = config.mcpServers['context-sync'];
      
      fs.writeFileSync(claudeConfigPath, JSON.stringify(existingConfig, null, 2));
      logSuccess('Updated existing configuration');
    } catch (error) {
      logError('Failed to read existing config, creating new one');
      fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
    }
  } else {
    // Create new config
    fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
    logSuccess('Created new Claude Desktop config');
  }

  console.log('');
  log('='.repeat(50), 'cyan');
  logSuccess('Setup Complete!');
  log('='.repeat(50), 'cyan');
  console.log('');

  printNextSteps(osType);
}

function printNextSteps(osType) {
  log('Next steps:', 'yellow');
  console.log('');
  console.log('1. Restart Claude Desktop completely');
  
  if (osType === 'mac') {
    console.log('   → Cmd+Q to quit, then reopen');
  } else if (osType === 'windows') {
    console.log('   → Right-click system tray icon → Exit, then reopen');
  } else {
    console.log('   → Close and reopen the application');
  }
  
  console.log('');
  console.log('2. Check Settings → Features → Model Context Protocol');
  console.log('   You should see "context-sync" with a green indicator');
  console.log('');
  console.log('3. Test it! Try saying:');
  console.log('   "Initialize a project called test-app"');
  console.log('');
  console.log('4. Then ask:');
  console.log('   "What\'s my current project?"');
  console.log('');
  
  const dataDir = path.join(os.homedir(), '.context-sync');
  log(`Data will be stored in: ${dataDir}`, 'cyan');
  console.log('');
  
  log('Troubleshooting:', 'yellow');
  console.log('- If server fails to connect, check Claude Desktop logs');
  console.log(`- Test server manually: node ${path.join(process.cwd(), 'dist', 'index.js')}`);
  console.log('- See TROUBLESHOOTING.md for common issues');
  console.log('');
}

// Run setup
setup().catch(error => {
  logError('Setup failed with error:');
  console.error(error);
  process.exit(1);
});