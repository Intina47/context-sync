/**
 * Test Git Hook Manager
 * Tests hook installation, uninstallation, and status checking
 */

import { GitHookManager } from './dist/git-hook-manager.js';
import path from 'path';
import os from 'os';

const projectPath = process.cwd();
const dbPath = path.join(os.homedir(), '.context-sync', 'data.db');

console.log('🧪 Testing Git Hook Manager\n');
console.log(`Project: ${projectPath}`);
console.log(`Database: ${dbPath}\n`);

const hookManager = new GitHookManager(projectPath, dbPath);

// Test 1: Check if git repo
console.log('1️⃣ Testing isGitRepo()...');
const isRepo = hookManager.isGitRepo();
console.log(`   Result: ${isRepo ? '✅ Is a git repository' : '❌ Not a git repository'}`);

if (!isRepo) {
  console.log('\n⚠️ Not a git repository. Skipping hook tests.');
  process.exit(0);
}

// Test 2: Check currently installed hooks
console.log('\n2️⃣ Checking currently installed hooks...');
const installedBefore = hookManager.getInstalledHooks();
console.log(`   Installed: ${installedBefore.length > 0 ? installedBefore.join(', ') : 'none'}`);

// Test 3: Install hooks
console.log('\n3️⃣ Installing git hooks...');
const installResult = hookManager.installHooks();
if (installResult.success) {
  console.log(`   ✅ Successfully installed ${installResult.installed.length} hook(s)`);
  installResult.installed.forEach(hook => {
    console.log(`      • ${hook}`);
  });
} else {
  console.log(`   ❌ Installation failed:`);
  installResult.errors.forEach(err => {
    console.log(`      • ${err}`);
  });
}

// Test 4: Verify installation
console.log('\n4️⃣ Verifying installation...');
const installedAfter = hookManager.getInstalledHooks();
console.log(`   Installed: ${installedAfter.join(', ')}`);

if (installedAfter.length === 4) {
  console.log('   ✅ All 4 hooks installed correctly');
} else {
  console.log(`   ⚠️ Expected 4 hooks, found ${installedAfter.length}`);
}

// Test 5: Check hook content
console.log('\n5️⃣ Checking hook content...');
import fs from 'fs';
const hookPath = path.join(projectPath, '.git', 'hooks', 'post-commit');
if (fs.existsSync(hookPath)) {
  const content = fs.readFileSync(hookPath, 'utf8');
  const hasMarker = content.includes('# Context Sync Auto-Hook');
  const hasNode = content.includes('node');
  const hasDatabase = content.includes(dbPath.replace(/\\/g, '/'));
  
  console.log(`   Marker: ${hasMarker ? '✅' : '❌'}`);
  console.log(`   Node command: ${hasNode ? '✅' : '❌'}`);
  console.log(`   Database path: ${hasDatabase ? '✅' : '❌'}`);
}

// Test 6: Test uninstall
console.log('\n6️⃣ Testing uninstall...');
const uninstallResult = hookManager.uninstallHooks();
console.log(`   Removed: ${uninstallResult.removed.join(', ')}`);

const installedFinal = hookManager.getInstalledHooks();
if (installedFinal.length === 0) {
  console.log('   ✅ All hooks uninstalled');
} else {
  console.log(`   ⚠️ ${installedFinal.length} hook(s) still installed`);
}

// Test 7: Reinstall for actual use
console.log('\n7️⃣ Reinstalling hooks for actual use...');
const reinstall = hookManager.installHooks();
if (reinstall.success) {
  console.log(`   ✅ Reinstalled ${reinstall.installed.length} hook(s)`);
  console.log('\n🎉 Git hooks are now active!');
  console.log('   Try making a commit to test automatic context capture.');
} else {
  console.log('   ❌ Reinstallation failed');
}

console.log('\n✅ All tests complete!');
