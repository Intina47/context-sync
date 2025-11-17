#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const readline = require('readline');

function usage() {
  console.log('Usage: node bin/register-continue.cjs [--yes] [--command "..."] [--args "a,b"] [--force] [--test-home "path"]');
  process.exit(1);
}

const argv = process.argv.slice(2);
let yes = false;
let force = false;
let cmd = process.env.CONTEXT_SYNC_REGISTER_CMD || 'npx';
let args = process.env.CONTEXT_SYNC_REGISTER_ARGS ? 
  process.env.CONTEXT_SYNC_REGISTER_ARGS.split(',').map(s => s.trim()).filter(Boolean) :
  ['-y', '@context-sync/server'];
let testHome = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--yes' || a === '-y') yes = true;
  else if (a === '--force') force = true;
  else if (a === '--command' && argv[i+1]) { cmd = argv[i+1]; i++; }
  else if (a === '--args' && argv[i+1]) { args = argv[i+1].split(',').map(s => s.trim()).filter(Boolean); i++; }
  else if (a === '--test-home' && argv[i+1]) { testHome = argv[i+1]; i++; }
  else if (a === '--help' || a === '-h') usage();
  else { console.log('Unknown arg', a); usage(); }
}

function getConfigPath(homeOverride) {
  const homedir = homeOverride || os.homedir();
  if (process.platform === 'win32') {
    return path.join(homedir, '.continue', 'config.yaml');
  }
  return path.join(homedir, '.continue', 'config.yaml');
}

async function prompt(question) {
  if (yes) return 'y';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const configPath = getConfigPath(testHome);
  console.log('Target Continue global config: ', configPath);

  // Read existing config if any
  let configObj = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      configObj = yaml.load(raw) || {};
    } catch (err) {
      console.error('Error reading existing config.yaml:', err.message);
      return process.exit(1);
    }
  }

  // Check for existing Context Sync entry
  const existingEntries = Array.isArray(configObj.mcpServers) ? configObj.mcpServers : [];
  const found = existingEntries.find(e => {
    if (!e) return false;
    if (e.name && typeof e.name === 'string' && e.name.toLowerCase().includes('context')) return true;
    if (e.command && typeof e.command === 'string' && e.command.includes('context-sync')) return true;
    return false;
  });

  if (found && !force) {
    console.log('Context Sync already registered in global Continue config. Use --force to overwrite.');
    return process.exit(0);
  }

  // Ask for consent
  const consent = yes ? 'y' : await prompt(`This will add Context Sync to your global Continue config at:\n  ${configPath}\nDo you want to proceed? (y/N): `);
  if (!consent || consent.trim().toLowerCase() !== 'y') {
    console.log('Aborted by user. No changes made.');
    return process.exit(0);
  }

  // Prepare new entry
  const newEntry = {
    name: 'Context Sync',
    type: 'stdio',
    command: cmd,
    args: args,
    env: {}
  };

  // Ensure backup
  ensureDirExists(configPath);
  if (fs.existsSync(configPath)) {
    const backupPath = `${configPath}.backup.${Date.now()}`;
    fs.copyFileSync(configPath, backupPath);
    console.log('Backup created at', backupPath);
  }

  // Merge
  if (!Array.isArray(configObj.mcpServers)) configObj.mcpServers = [];
  // Remove existing context-sync-like entries if force
  if (force) {
    configObj.mcpServers = configObj.mcpServers.filter(e => {
      if (!e) return true;
      if (e.name && typeof e.name === 'string' && e.name.toLowerCase().includes('context')) return false;
      if (e.command && typeof e.command === 'string' && e.command.includes('context-sync')) return false;
      return true;
    });
  }

  configObj.mcpServers.push(newEntry);

  try {
    const out = yaml.dump(configObj, { noRefs: true, sortKeys: false });
    fs.writeFileSync(configPath, out, 'utf8');
    console.log('Successfully wrote Context Sync entry to Continue global config.');
  } catch (err) {
    console.error('Error writing config file:', err.message);
    return process.exit(1);
  }
}

main();
