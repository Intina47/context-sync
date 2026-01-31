/**
 * Git Hook Manager
 * Automatically installs git hooks to capture development events
 * Auto-remembers: commits, pushes, merges, branch switches
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface GitHookConfig {
  projectPath: string;
  dbPath: string;
  enabled: boolean;
}

export class GitHookManager {
  private projectPath: string;
  private hooksDir: string;
  private dbPath: string;

  constructor(projectPath: string, dbPath: string) {
    this.projectPath = projectPath;
    this.hooksDir = path.join(projectPath, '.git', 'hooks');
    this.dbPath = dbPath;
  }

  /**
   * Check if project is a git repository
   */
  isGitRepo(): boolean {
    try {
      return fs.existsSync(path.join(this.projectPath, '.git'));
    } catch {
      return false;
    }
  }

  /**
   * Install all Context Sync git hooks
   */
  installHooks(): { success: boolean; installed: string[]; errors: string[] } {
    if (!this.isGitRepo()) {
      return {
        success: false,
        installed: [],
        errors: ['Not a git repository']
      };
    }

    const installed: string[] = [];
    const errors: string[] = [];

    // Ensure hooks directory exists
    if (!fs.existsSync(this.hooksDir)) {
      fs.mkdirSync(this.hooksDir, { recursive: true });
    }

    // Install each hook
    const hooks = [
      { name: 'post-commit', generator: this.generatePostCommitHook.bind(this) },
      { name: 'pre-push', generator: this.generatePrePushHook.bind(this) },
      { name: 'post-merge', generator: this.generatePostMergeHook.bind(this) },
      { name: 'post-checkout', generator: this.generatePostCheckoutHook.bind(this) }
    ];

    for (const hook of hooks) {
      try {
        const hookPath = path.join(this.hooksDir, hook.name);
        const hookContent = hook.generator();
        
        // Backup existing hook if it exists
        if (fs.existsSync(hookPath)) {
          const backupPath = `${hookPath}.backup-${Date.now()}`;
          fs.copyFileSync(hookPath, backupPath);
        }

        // Write hook
        fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
        installed.push(hook.name);
      } catch (error: any) {
        errors.push(`Failed to install ${hook.name}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      installed,
      errors
    };
  }

  /**
   * Uninstall Context Sync hooks (restores backups if available)
   */
  uninstallHooks(): { success: boolean; removed: string[] } {
    const removed: string[] = [];
    const hooks = ['post-commit', 'pre-push', 'post-merge', 'post-checkout'];

    for (const hookName of hooks) {
      const hookPath = path.join(this.hooksDir, hookName);
      
      if (fs.existsSync(hookPath)) {
        // Check if it's a Context Sync hook
        const content = fs.readFileSync(hookPath, 'utf8');
        if (content.includes('# Context Sync Auto-Hook')) {
          fs.unlinkSync(hookPath);
          removed.push(hookName);

          // Restore backup if available
          const backups = fs.readdirSync(this.hooksDir)
            .filter(f => f.startsWith(`${hookName}.backup-`))
            .sort()
            .reverse();
          
          if (backups.length > 0) {
            const latestBackup = path.join(this.hooksDir, backups[0]);
            fs.copyFileSync(latestBackup, hookPath);
          }
        }
      }
    }

    return { success: true, removed };
  }

  /**
   * Check which hooks are installed
   */
  getInstalledHooks(): string[] {
    const installed: string[] = [];
    const hooks = ['post-commit', 'pre-push', 'post-merge', 'post-checkout'];

    for (const hookName of hooks) {
      const hookPath = path.join(this.hooksDir, hookName);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf8');
        if (content.includes('# Context Sync Auto-Hook')) {
          installed.push(hookName);
        }
      }
    }

    return installed;
  }

  /**
   * Generate post-commit hook (captures commits)
   */
  private generatePostCommitHook(): string {
    const isWindows = process.platform === 'win32';
    const nodeCmd = isWindows ? 'node.exe' : 'node';
    
    // Escape database path for shell
    const escapedDbPath = this.dbPath.replace(/\\/g, '/');
    
    return `#!/bin/sh
# Context Sync Auto-Hook: post-commit
# Automatically captures commit information

${nodeCmd} -e "
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

try {
  // Get commit info
  const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const commitMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const filesChanged = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { encoding: 'utf8' })
    .trim().split('\\\\n').filter(f => f);

  // Connect to Context Sync database
  const db = new Database('${escapedDbPath}');
  
  // Get current project
  const project = db.prepare('SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1').get();
  if (!project) {
    console.log('Context Sync: No project found');
    process.exit(0);
  }

  // Store commit as decision
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  
  const sql = 'INSERT INTO decisions (id, project_id, type, description, reasoning, timestamp) VALUES (?, ?, ?, ?, ?, ?)';
  db.prepare(sql).run(
    id,
    project.id,
    'commit',
    'Committed: ' + commitMsg.split('\\\\n')[0],
    JSON.stringify({
      commit: commitHash,
      branch: branch,
      files: filesChanged,
      fullMessage: commitMsg,
      event: 'commit'
    }),
    Date.now()
  );

  db.close();
  console.log(' Context Sync: Captured commit ' + commitHash.substring(0, 7));
} catch (error) {
  // Fail silently to not interrupt git workflow
  console.error('Context Sync hook error:', error.message);
}
"
`;
  }

  /**
   * Generate pre-push hook (captures pushes to production)
   */
  private generatePrePushHook(): string {
    const isWindows = process.platform === 'win32';
    const nodeCmd = isWindows ? 'node.exe' : 'node';
    const escapedDbPath = this.dbPath.replace(/\\/g, '/');

    return `#!/bin/sh
# Context Sync Auto-Hook: pre-push
# Automatically captures push events (production tracking)

${nodeCmd} -e "
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

try {
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const remote = process.argv[2] || 'origin';
  
  // Count commits about to be pushed
  const ahead = execSync('git rev-list @{u}..HEAD --count 2>/dev/null || echo 0', { encoding: 'utf8' }).trim();
  
  // Connect to Context Sync database
  const db = new Database('${escapedDbPath}');
  
  // Get current project
  const project = db.prepare('SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1').get();
  if (!project) {
    console.log('Context Sync: No project found');
    process.exit(0);
  }

  // Store push as decision
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  
  const isProduction = branch === 'main' || branch === 'master' || branch === 'production';
  
  const sql = 'INSERT INTO decisions (id, project_id, type, description, reasoning, timestamp) VALUES (?, ?, ?, ?, ?, ?)';
  db.prepare(sql).run(
    id,
    project.id,
    'push',
    'Pushing ' + ahead + ' commit(s) to ' + remote + '/' + branch + (isProduction ? ' (PRODUCTION)' : ''),
    JSON.stringify({
      remote: remote,
      branch: branch,
      commits: parseInt(ahead),
      production: isProduction,
      event: 'push'
    }),
    Date.now()
  );

  db.close();
  console.log(' Context Sync: Tracked push to ' + remote + '/' + branch);
} catch (error) {
  console.error('Context Sync hook error:', error.message);
}
"
`;
  }

  /**
   * Generate post-merge hook (captures merges)
   */
  private generatePostMergeHook(): string {
    const isWindows = process.platform === 'win32';
    const nodeCmd = isWindows ? 'node.exe' : 'node';
    const escapedDbPath = this.dbPath.replace(/\\/g, '/');

    return `#!/bin/sh
# Context Sync Auto-Hook: post-merge
# Automatically captures merge events (feature completions)

${nodeCmd} -e "
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

try {
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const mergeHead = process.env.GIT_REFLOG_ACTION || 'merge';
  
  // Extract source branch from merge message
  const lastCommit = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
  const mergeMatch = lastCommit.match(/Merge (?:branch|pull request) ['\\\\\"](.*)['\\\\\"]/);
  const fromBranch = mergeMatch ? mergeMatch[1] : 'unknown';
  
  // Connect to Context Sync database
  const db = new Database('${escapedDbPath}');
  
  // Get current project
  const project = db.prepare('SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1').get();
  if (!project) {
    console.log('Context Sync: No project found');
    process.exit(0);
  }

  // Store merge as decision
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  
  const sql = 'INSERT INTO decisions (id, project_id, type, description, reasoning, timestamp) VALUES (?, ?, ?, ?, ?, ?)';
  db.prepare(sql).run(
    id,
    project.id,
    'merge',
    'Merged ' + fromBranch + ' into ' + branch,
    JSON.stringify({
      from: fromBranch,
      to: branch,
      mergeCommit: lastCommit,
      event: 'merge'
    }),
    Date.now()
  );

  db.close();
  console.log(' Context Sync: Captured merge ' + fromBranch + '  ' + branch);
} catch (error) {
  console.error('Context Sync hook error:', error.message);
}
"
`;
  }

  /**
   * Generate post-checkout hook (captures branch switches)
   */
  private generatePostCheckoutHook(): string {
    const isWindows = process.platform === 'win32';
    const nodeCmd = isWindows ? 'node.exe' : 'node';
    const escapedDbPath = this.dbPath.replace(/\\/g, '/');

    return `#!/bin/sh
# Context Sync Auto-Hook: post-checkout
# Automatically captures branch switches (context switching)

# Args: previous-head new-head branch-checkout-flag
PREV_HEAD=\$1
NEW_HEAD=\$2
BRANCH_CHECKOUT=\$3

# Only track branch checkouts (not file checkouts)
if [ "\$BRANCH_CHECKOUT" != "1" ]; then
  exit 0
fi

${nodeCmd} -e "
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

try {
  const newBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const prevHead = process.argv[2];
  
  // Get previous branch name
  let prevBranch = 'unknown';
  try {
    prevBranch = execSync('git name-rev --name-only ' + prevHead, { encoding: 'utf8' }).trim();
  } catch {}
  
  // Skip if same branch (happens on initial checkout)
  if (prevBranch === newBranch) {
    process.exit(0);
  }
  
  // Connect to Context Sync database
  const db = new Database('${escapedDbPath}');
  
  // Get current project
  const project = db.prepare('SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1').get();
  if (!project) {
    console.log('Context Sync: No project found');
    process.exit(0);
  }

  // Store branch switch as active_work
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  
  const sql = 'INSERT INTO active_work (id, project_id, task, context, branch, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.prepare(sql).run(
    id,
    project.id,
    'Switched to branch: ' + newBranch,
    JSON.stringify({
      from: prevBranch,
      to: newBranch,
      event: 'checkout'
    }),
    newBranch,
    Date.now(),
    'active'
  );

  db.close();
  console.log(' Context Sync: Tracked branch switch ' + prevBranch + '  ' + newBranch);
} catch (error) {
  console.error('Context Sync hook error:', error.message);
}
" "\$PREV_HEAD" "\$NEW_HEAD"
`;
  }
}


