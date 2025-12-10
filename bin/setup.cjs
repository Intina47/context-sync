#!/usr/bin/env node

/**
 * Context Sync Setup CLI
 * Interactive configuration for Context Sync and integrations
 */

const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const CONFIG_DIR = path.join(os.homedir(), '.context-sync');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function log(color, message) {
  console.log(color + message + colors.reset);
}

/**
 * Load existing config
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Config doesn't exist or is invalid
  }
  return { setupComplete: false };
}

/**
 * Save config
 */
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    log(colors.red, `✗ Error saving config: ${error.message}`);
    return false;
  }
}

/**
 * Setup Notion Integration
 */
async function setupNotionIntegration(config) {
  log(colors.cyan + colors.bold, '\n📝 Notion Integration Setup\n');
  
  log(colors.white, 'Context Sync can sync your AI context directly to Notion pages.\n');
  
  // Check if already configured
  if (config.notion && config.notion.token) {
    log(colors.green, '✓ Notion is already configured!');
    log(colors.gray, `  Configured: ${config.notion.configuredAt}`);
    if (config.notion.defaultParentPageId) {
      log(colors.gray, `  Default parent page: ${config.notion.defaultParentPageId}`);
    }
    
    const reconfigure = readlineSync.keyInYNStrict('\nWould you like to reconfigure Notion?');
    if (!reconfigure) {
      return;
    }
  }
  
  // Step 1: Create integration
  log(colors.yellow, '\n📋 Step 1: Create a Notion Integration');
  log(colors.gray, '  1. Visit: https://www.notion.so/my-integrations');
  log(colors.gray, '  2. Click "New integration"');
  log(colors.gray, '  3. Give it a name (e.g., "Context Sync")');
  log(colors.gray, '  4. Select your workspace');
  log(colors.gray, '  5. Copy the "Internal Integration Token"\n');
  
  const shouldOpenBrowser = readlineSync.keyInYNStrict('Open Notion integrations page in browser?');
  if (shouldOpenBrowser) {
    try {
      // Use platform-specific command to open browser
      const url = 'https://www.notion.so/my-integrations';
      const command = process.platform === 'win32' ? `start ${url}` : 
                     process.platform === 'darwin' ? `open ${url}` : 
                     `xdg-open ${url}`;
      exec(command);
      log(colors.green, '✓ Opening browser...\n');
    } catch (error) {
      log(colors.yellow, '⚠️  Could not open browser automatically');
      log(colors.gray, '   Please visit: https://www.notion.so/my-integrations\n');
    }
  }
  
  // Step 2: Get token
  log(colors.yellow, '\n🔑 Step 2: Enter Your Integration Token');
  const rawToken = readlineSync.question('Paste your Notion integration token: ', {
    hideEchoBack: true
  });
  
  // Trim whitespace that might be added during paste
  const token = rawToken ? rawToken.trim() : '';
  
  // Validate token format - Notion uses different prefixes
  // Old format: secret_xxxxx
  // New format: ntn_xxxxx
  const isValidFormat = token && (token.startsWith('secret_') || token.startsWith('ntn_'));
  
  if (!isValidFormat) {
    log(colors.red, '✗ Invalid token format. Notion tokens start with "secret_" or "ntn_"');
    log(colors.gray, '  Token should start with: secret_ or ntn_');
    log(colors.gray, `  Received length: ${token.length} chars`);
    log(colors.gray, `  First 10 chars: ${token.substring(0, 10)}...\n`);
    return;
  }
  
  // Step 3: Test connection and get pages
  log(colors.cyan, '\n🔍 Testing connection...');
  
  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: token });
    
    // Search for pages
    const response = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 20
    });
    
    if (response.results.length === 0) {
      log(colors.yellow, '\n⚠️  No pages found!');
      log(colors.gray, '\nMake sure to:');
      log(colors.gray, '  1. Share a page with your integration');
      log(colors.gray, '  2. Open the page in Notion');
      log(colors.gray, '  3. Click "Share" → Add your integration\n');
      
      const continueAnyway = readlineSync.keyInYNStrict('Save token anyway and configure pages later?');
      if (!continueAnyway) {
        return;
      }
      
      // Save token only
      config.notion = {
        token,
        configuredAt: new Date().toISOString()
      };
      
      if (saveConfig(config)) {
        log(colors.green, '\n✓ Notion token saved!');
        log(colors.cyan, '\nRemember to share pages with your integration before using Notion tools.');
      }
      return;
    }
    
    log(colors.green, `✓ Connected! Found ${response.results.length} accessible pages\n`);
    
    // Step 4: Select default parent page
    log(colors.yellow, '📄 Step 3: Select Default Parent Page (Optional)');
    log(colors.gray, 'New pages will be created as children of this page.\n');
    
    const pages = response.results.map((page, index) => {
      const title = page.properties?.title?.title?.[0]?.plain_text || 
                   page.properties?.Name?.title?.[0]?.plain_text ||
                   'Untitled';
      return {
        index: index + 1,
        id: page.id,
        title: title.length > 60 ? title.substring(0, 60) + '...' : title
      };
    });
    
    // Display pages
    pages.forEach(page => {
      log(colors.white, `  ${page.index}. ${page.title}`);
    });
    
    if (response.results.length === 20) {
      log(colors.gray, `  ... and more pages available`);
    }
    
    log(colors.gray, '\n  0. Skip (configure later)');
    
    const selection = readlineSync.questionInt('\nSelect a page number: ', {
      limit: (input) => input >= 0 && input <= pages.length
    });
    
    let defaultParentPageId;
    if (selection > 0) {
      defaultParentPageId = pages[selection - 1].id;
      log(colors.green, `✓ Selected: ${pages[selection - 1].title}`);
    } else {
      log(colors.gray, '✓ Skipped default parent page');
    }
    
    // Save config
    config.notion = {
      token,
      defaultParentPageId,
      configuredAt: new Date().toISOString()
    };
    
    if (saveConfig(config)) {
      log(colors.green + colors.bold, '\n✨ Notion integration configured successfully!\n');
      log(colors.cyan, 'You can now use Notion tools in Context Sync:');
      log(colors.white, '  • notion_create_page - Create new Notion pages');
      log(colors.white, '  • notion_read_page - Read Notion page content');
      log(colors.white, '  • notion_search - Search your Notion workspace');
      log(colors.white, '  • create_project_dashboard - Auto-generate project docs');
      log(colors.white, '  • sync_decision_to_notion - Export architecture decisions\n');
    }
    
  } catch (error) {
    log(colors.red, `✗ Connection failed: ${error.message}`);
    if (error.code === 'unauthorized') {
      log(colors.yellow, '\n⚠️  Token is invalid or integration was deleted.');
      log(colors.gray, 'Please verify your integration token and try again.');
    }
    return;
  }
}

/**
 * Main setup flow
 */
async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   🧠 Context Sync Setup Wizard      ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Load existing config
  const config = loadConfig();

  log(colors.white, 'Welcome to Context Sync!\n');
  log(colors.gray, 'This wizard will help you configure integrations.\n');

  // Setup Notion
  const setupNotion = readlineSync.keyInYNStrict('Would you like to integrate with Notion?');
  
  if (setupNotion) {
    await setupNotionIntegration(config);
  } else {
    log(colors.gray, '✓ Skipping Notion integration\n');
  }

  // Mark setup as complete
  config.setupComplete = true;
  saveConfig(config);

  log(colors.green + colors.bold, '\n✅ Setup complete!\n');
  log(colors.cyan, 'Context Sync is ready to use with your AI assistant.');
  log(colors.gray, '\nYou can run this setup again anytime with:');
  log(colors.white, '  context-sync-setup\n');
}

// Run setup
main().catch(error => {
  log(colors.red, `\n✗ Setup failed: ${error.message}`);
  process.exit(1);
});
