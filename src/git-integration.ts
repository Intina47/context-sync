// Git Integration for Version Control Operations

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface GitStatus {
  branch: string;
  modified: string[];
  untracked: string[];
  staged: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}

export interface GitBranchInfo {
  current: string;
  all: string[];
  recent: Array<{ name: string; lastCommit: string }>;
}

export class GitIntegration {
  constructor(private workspacePath: string) {}

  /**
   * Check if current workspace is a git repository
   */
  isGitRepo(): boolean {
    try {
      const gitDir = path.join(this.workspacePath, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  /**
   * Get git status
   */
  getStatus(): GitStatus | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      const statusOutput = this.exec('git status --porcelain --branch');
      const lines = statusOutput.split('\n').filter(line => line.trim());

      const status: GitStatus = {
        branch: 'unknown',
        modified: [],
        untracked: [],
        staged: [],
        ahead: 0,
        behind: 0,
        clean: true
      };

      for (const line of lines) {
        if (line.startsWith('##')) {
          // Branch info
          const branchMatch = line.match(/## ([^\s.]+)/);
          if (branchMatch) {
            status.branch = branchMatch[1];
          }

          const aheadMatch = line.match(/ahead (\d+)/);
          const behindMatch = line.match(/behind (\d+)/);
          
          if (aheadMatch) status.ahead = parseInt(aheadMatch[1]);
          if (behindMatch) status.behind = parseInt(behindMatch[1]);
        } else {
          const statusCode = line.substring(0, 2);
          const filepath = line.substring(3);

          status.clean = false;

          // Staged changes
          if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
            status.staged.push(filepath);
          }

          // Modified (unstaged)
          if (statusCode[1] === 'M') {
            status.modified.push(filepath);
          }

          // Untracked
          if (statusCode === '??') {
            status.untracked.push(filepath);
          }
        }
      }

      return status;
    } catch (error) {
      console.error('Error getting git status:', error);
      return null;
    }
  }

  /**
   * Get diff for file(s)
   */
  getDiff(filepath?: string, staged: boolean = false): string | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      const stagedFlag = staged ? '--staged' : '';
      const fileArg = filepath ? `-- "${filepath}"` : '';
      const command = `git diff ${stagedFlag} ${fileArg}`.trim();
      
      return this.exec(command);
    } catch (error) {
      console.error('Error getting git diff:', error);
      return null;
    }
  }

  /**
   * Get current branch information
   */
  getBranchInfo(action: 'current' | 'list' | 'recent' = 'current'): GitBranchInfo | string | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      if (action === 'current') {
        const branch = this.exec('git branch --show-current').trim();
        return branch;
      }

      if (action === 'list') {
        const output = this.exec('git branch -a');
        const branches = output
          .split('\n')
          .map(b => b.trim().replace(/^\*\s+/, ''))
          .filter(b => b.length > 0);

        const current = this.exec('git branch --show-current').trim();

        return {
          current,
          all: branches,
          recent: []
        };
      }

      if (action === 'recent') {
        const output = this.exec('git for-each-ref --sort=-committerdate refs/heads/ --format="%(refname:short)|%(committerdate:relative)" --count=10');
        const branches = output
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [name, lastCommit] = line.split('|');
            return { name, lastCommit };
          });

        const current = this.exec('git branch --show-current').trim();

        return {
          current,
          all: [],
          recent: branches
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting branch info:', error);
      return null;
    }
  }

  /**
   * Suggest commit message based on changes
   */
  suggestCommitMessage(files: string[] = [], convention: string = 'conventional'): string | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      const status = this.getStatus();
      if (!status) return null;

      const changedFiles = files.length > 0 ? files : [...status.staged, ...status.modified];
      
      if (changedFiles.length === 0) {
        return 'No changes to commit';
      }

      // Analyze changed files to determine type and scope
      const analysis = this.analyzeChanges(changedFiles);

      if (convention === 'conventional') {
        return this.generateConventionalCommit(analysis, changedFiles);
      } else if (convention === 'simple') {
        return this.generateSimpleCommit(analysis, changedFiles);
      } else {
        return this.generateDescriptiveCommit(analysis, changedFiles);
      }
    } catch (error) {
      console.error('Error suggesting commit message:', error);
      return null;
    }
  }

  /**
   * Get last N commits
   */
  getRecentCommits(count: number = 5): Array<{ hash: string; message: string; author: string; date: string }> | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      const output = this.exec(`git log -${count} --pretty=format:"%H|%s|%an|%ar"`);
      
      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, message, author, date] = line.split('|');
          return { hash, message, author, date };
        });
    } catch (error) {
      console.error('Error getting recent commits:', error);
      return null;
    }
  }

  /**
   * Check if file is tracked by git
   */
  isTracked(filepath: string): boolean {
    if (!this.isGitRepo()) {
      return false;
    }

    try {
      this.exec(`git ls-files --error-unmatch "${filepath}"`);
      return true;
    } catch {
      return false;
    }
  }

  // ========== PRIVATE HELPER METHODS ==========

  private exec(command: string): string {
    return execSync(command, {
      cwd: this.workspacePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  private analyzeChanges(files: string[]): {
    type: string;
    scope: string;
    hasTests: boolean;
    hasDocs: boolean;
    isBreaking: boolean;
  } {
    const analysis = {
      type: 'chore',
      scope: '',
      hasTests: false,
      hasDocs: false,
      isBreaking: false
    };

    // Determine type based on file patterns
    const hasNewFiles = files.some(f => !this.isTracked(f));
    const hasComponents = files.some(f => f.includes('component') || f.match(/\.(tsx|jsx)$/));
    const hasApi = files.some(f => f.includes('api') || f.includes('route'));
    const hasModels = files.some(f => f.includes('model') || f.includes('schema'));
    const hasTests = files.some(f => f.includes('.test.') || f.includes('.spec.'));
    const hasDocs = files.some(f => f.match(/\.(md|txt)$/i));
    const hasConfig = files.some(f => f.match(/\.(json|yaml|yml|toml|config)$/));

    analysis.hasTests = hasTests;
    analysis.hasDocs = hasDocs;

    if (hasNewFiles && hasComponents) {
      analysis.type = 'feat';
      analysis.scope = 'components';
    } else if (hasNewFiles && hasApi) {
      analysis.type = 'feat';
      analysis.scope = 'api';
    } else if (hasComponents) {
      analysis.type = 'fix';
      analysis.scope = 'components';
    } else if (hasApi) {
      analysis.type = 'fix';
      analysis.scope = 'api';
    } else if (hasModels) {
      analysis.type = 'feat';
      analysis.scope = 'models';
    } else if (hasTests) {
      analysis.type = 'test';
    } else if (hasDocs) {
      analysis.type = 'docs';
    } else if (hasConfig) {
      analysis.type = 'chore';
      analysis.scope = 'config';
    }

    return analysis;
  }

  private generateConventionalCommit(
    analysis: { type: string; scope: string; hasTests: boolean; hasDocs: boolean },
    files: string[]
  ): string {
    const scope = analysis.scope ? `(${analysis.scope})` : '';
    const description = this.generateDescription(files);

    let message = `${analysis.type}${scope}: ${description}\n\n`;

    // Add details
    const details: string[] = [];
    
    for (const file of files.slice(0, 5)) {
      const action = this.isTracked(file) ? 'Update' : 'Add';
      details.push(`- ${action} ${file}`);
    }

    if (files.length > 5) {
      details.push(`- And ${files.length - 5} more files`);
    }

    message += details.join('\n');

    // Add footers
    if (analysis.hasTests) {
      message += '\n\nTests: Added/updated';
    }

    return message;
  }

  private generateSimpleCommit(
    analysis: { type: string },
    files: string[]
  ): string {
    const description = this.generateDescription(files);
    return `${analysis.type}: ${description}`;
  }

  private generateDescriptiveCommit(
    analysis: { type: string; scope: string },
    files: string[]
  ): string {
    const description = this.generateDescription(files);
    const scope = analysis.scope ? ` in ${analysis.scope}` : '';
    
    return `${description}${scope}\n\nFiles changed:\n${files.slice(0, 10).map(f => `- ${f}`).join('\n')}`;
  }

  private generateDescription(files: string[]): string {
    // Try to infer description from file patterns
    if (files.length === 1) {
      const file = path.basename(files[0], path.extname(files[0]));
      return `update ${file}`;
    }

    const hasComponents = files.some(f => f.includes('component'));
    const hasApi = files.some(f => f.includes('api'));
    const hasModels = files.some(f => f.includes('model'));
    const hasAuth = files.some(f => f.includes('auth'));

    if (hasAuth) return 'update authentication';
    if (hasComponents) return 'update components';
    if (hasApi) return 'update API routes';
    if (hasModels) return 'update data models';

    return `update ${files.length} files`;
  }
}