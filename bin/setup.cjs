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

function printHeader(title) {
  console.log('\n' + '='.repeat(64));
  log(colors.cyan + colors.bold, title);
  console.log('='.repeat(64) + '\n');
}

function promptYesNo(question) {
  return readlineSync.keyInYNStrict(question);
}

function promptToken() {
  while (true) {
    const rawToken = readlineSync.question('Paste your Notion integration token: ', {
      hideEchoBack: true
    });
    const token = rawToken ? rawToken.trim() : '';

    if (!token) {
      log(colors.yellow, 'Token is empty.');
      if (!promptYesNo('Try again?')) return null;
      continue;
    }

    const isValidFormat = token.startsWith('secret_') || token.startsWith('ntn_');
    if (!isValidFormat) {
      log(colors.red, 'Invalid token format. Notion tokens start with "secret_" or "ntn_".');
      log(colors.gray, `Received length: ${token.length} chars`);
      log(colors.gray, `First 10 chars: ${token.substring(0, 10)}...\n`);
      if (!promptYesNo('Try again?')) return null;
      continue;
    }

    return token;
  }
}

async function fetchNotionPages(token) {
  const { Client } = require('@notionhq/client');
  const notion = new Client({ auth: token });
  const response = await notion.search({
    filter: { property: 'object', value: 'page' },
    page_size: 20
  });
  return response.results || [];
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
    log(colors.red, ` Error saving config: ${error.message}`);
    return false;
  }
}

/**
 * Setup Notion Integration
 */
async function setupNotionIntegration(config) {
  printHeader('Notion Integration Setup');
  log(colors.white, 'This wizard configures Notion for Context Sync.\n');

  if (config.notion && config.notion.token) {
    log(colors.green, 'OK Notion is already configured.');
    log(colors.gray, `Configured: ${config.notion.configuredAt}`);
    if (config.notion.defaultParentPageId) {
      log(colors.gray, `Default parent page: ${config.notion.defaultParentPageId}`);
    }
    if (!promptYesNo('\nWould you like to reconfigure Notion?')) return;
  }

  log(colors.yellow, '\nStep 1 of 3: Create a Notion integration');
  log(colors.gray, '  1. Visit: https://www.notion.so/my-integrations');
  log(colors.gray, '  2. Click "New integration"');
  log(colors.gray, '  3. Give it a name (e.g., "Context Sync")');
  log(colors.gray, '  4. Select your workspace');
  log(colors.gray, '  5. Copy the "Internal Integration Token"\n');

  if (promptYesNo('Open Notion integrations page in browser?')) {
    try {
      const url = 'https://www.notion.so/my-integrations';
      const command = process.platform === 'win32' ? `start ${url}` :
                     process.platform === 'darwin' ? `open ${url}` :
                     `xdg-open ${url}`;
      exec(command);
      log(colors.green, 'OK Opening browser...\n');
    } catch (error) {
      log(colors.yellow, 'WARN  Could not open browser automatically');
      log(colors.gray, '   Please visit: https://www.notion.so/my-integrations\n');
    }
  }

  log(colors.yellow, '\nStep 2 of 3: Enter your integration token');
  let token = promptToken();
  if (!token) return;

  log(colors.cyan, '\nTesting connection...');

  let pages = [];
  while (true) {
    try {
      pages = await fetchNotionPages(token);
    } catch (error) {
      log(colors.red, `ERROR Connection failed: ${error.message}`);
      if (error.code === 'unauthorized') {
        log(colors.yellow, 'Token is invalid or integration was deleted.');
      }
      if (promptYesNo('Try a different token?')) {
        token = promptToken();
        if (!token) return;
        continue;
      }
      if (promptYesNo('Save token anyway and configure later?')) {
        config.notion = { token, configuredAt: new Date().toISOString() };
        if (saveConfig(config)) {
          log(colors.green, '\nOK Notion token saved.');
        }
      }
      return;
    }

    if (pages.length === 0) {
      log(colors.yellow, '\nNo accessible pages found.');
      log(colors.gray, 'Make sure to share at least one page with your integration.');
      if (promptYesNo('Retry after sharing a page?')) {
        continue;
      }
      if (promptYesNo('Save token anyway and configure pages later?')) {
        config.notion = { token, configuredAt: new Date().toISOString() };
        if (saveConfig(config)) {
          log(colors.green, '\nOK Notion token saved.');
          log(colors.gray, 'Share pages with the integration before using Notion tools.');
        }
      }
      return;
    }
    break;
  }

  log(colors.green, `OK Connected! Found ${pages.length} accessible pages\n`);

  log(colors.yellow, 'Step 3 of 3: Select default parent page (optional)');
  log(colors.gray, 'New pages will be created as children of this page.\n');

  const choices = pages.map((page, index) => {
    const title = page.properties?.title?.title?.[0]?.plain_text ||
                 page.properties?.Name?.title?.[0]?.plain_text ||
                 'Untitled';
    return {
      index: index + 1,
      id: page.id,
      title: title.length > 60 ? title.substring(0, 60) + '...' : title
    };
  });

  choices.forEach(page => {
    log(colors.white, `  ${page.index}. ${page.title}`);
  });

  if (pages.length === 20) {
    log(colors.gray, '  ... and more pages available');
  }

  log(colors.gray, '\n  0. Skip (configure later)');
  log(colors.gray, '  M. Enter page ID manually');

  let defaultParentPageId;
  while (true) {
    const selection = readlineSync.question('\nSelect a page number or M: ').trim();
    if (selection.toLowerCase() === 'm') {
      const manualId = readlineSync.question('Enter Notion page ID: ').trim();
      if (manualId) {
        defaultParentPageId = manualId;
        log(colors.green, 'OK Default parent page set');
        break;
      }
      log(colors.yellow, 'Page ID is empty.');
      continue;
    }
    const numeric = Number(selection);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= choices.length) {
      if (numeric === 0) {
        log(colors.gray, 'OK Skipped default parent page');
      } else {
        defaultParentPageId = choices[numeric - 1].id;
        log(colors.green, `OK Selected: ${choices[numeric - 1].title}`);
      }
      break;
    }
    log(colors.yellow, 'Invalid selection.');
  }

  config.notion = {
    token,
    defaultParentPageId,
    configuredAt: new Date().toISOString()
  };

  if (saveConfig(config)) {
    log(colors.green + colors.bold, '\nOK Notion integration configured successfully!\n');
    log(colors.cyan, 'You can now use Notion tools in Context Sync:');
    log(colors.white, '  - notion.search - Search your Notion workspace');
    log(colors.white, '  - notion.read - Read Notion page content\n');
  }
}

/**
 * Main setup flow
 */
async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║    Context Sync Setup Wizard      ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Load existing config
  const config = loadConfig();

  log(colors.white, 'Welcome to Context Sync!\n');
  log(colors.gray, 'This wizard configures Notion only.\n');

  // Setup Notion
  const setupNotion = promptYesNo('Would you like to integrate with Notion?');
  
  if (setupNotion) {
    await setupNotionIntegration(config);
  } else {
    log(colors.gray, 'OK Skipping Notion integration\n');
  }

  // Mark setup as complete
  config.setupComplete = true;
  saveConfig(config);

  log(colors.green + colors.bold, '\nOK Setup complete!\n');
  log(colors.cyan, 'Context Sync is ready to use with your AI assistant.');
  log(colors.gray, '\nYou can run this setup again anytime with:');
  log(colors.white, '  context-sync-setup\n');
}

// Run setup
main().catch(error => {
  log(colors.red, `\nERROR Setup failed: ${error.message}`);
  process.exit(1);
});



