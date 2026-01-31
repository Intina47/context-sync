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

  /**
   * Get hotspots - files with high change frequency (risk analysis)
   */
  getHotspots(limit: number = 10): Array<{ file: string; changes: number; lastChanged: string; risk: string }> | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      // Get file change frequency from git log
      const output = this.exec('git log --format=format: --name-only --since="6 months ago"');
      const files = output.split('\n').filter(f => f.trim() && !f.startsWith('commit'));
      
      // Count changes per file
      const changeCount = new Map<string, number>();
      for (const file of files) {
        changeCount.set(file, (changeCount.get(file) || 0) + 1);
      }

      // Sort by change frequency
      const sorted = Array.from(changeCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get last changed date for each file
      const hotspots = sorted.map(([file, changes]) => {
        try {
          const lastChanged = this.exec(`git log -1 --format="%ar" -- "${file}"`).trim();
          
          // Risk calculation based on change frequency
          let risk = 'low';
          if (changes > 50) risk = 'critical';
          else if (changes > 30) risk = 'high';
          else if (changes > 15) risk = 'medium';
          
          return { file, changes, lastChanged, risk };
        } catch {
          return { file, changes, lastChanged: 'unknown', risk: 'low' };
        }
      });

      return hotspots;
    } catch (error) {
      console.error('Error getting hotspots:', error);
      return null;
    }
  }

  /**
   * Get file coupling - files that frequently change together (hidden dependencies)
   */
  getFileCoupling(minCoupling: number = 3): Array<{ fileA: string; fileB: string; timesChanged: number; coupling: string }> | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      // Get commits with changed files
      const output = this.exec('git log --format="COMMIT:%H" --name-only --since="6 months ago"');
      const lines = output.split('\n');

      // Parse commits and their files
      const commits: string[][] = [];
      let currentCommit: string[] = [];

      for (const line of lines) {
        if (line.startsWith('COMMIT:')) {
          if (currentCommit.length > 0) {
            commits.push([...currentCommit]);
          }
          currentCommit = [];
        } else if (line.trim()) {
          currentCommit.push(line.trim());
        }
      }
      if (currentCommit.length > 0) {
        commits.push(currentCommit);
      }

      // Count co-changes
      const couplingMap = new Map<string, number>();

      for (const files of commits) {
        if (files.length < 2) continue;

        // For each pair of files in the commit
        for (let i = 0; i < files.length; i++) {
          for (let j = i + 1; j < files.length; j++) {
            const pair = [files[i], files[j]].sort().join('|||');
            couplingMap.set(pair, (couplingMap.get(pair) || 0) + 1);
          }
        }
      }

      // Filter and format results
      const couplings = Array.from(couplingMap.entries())
        .filter(([_, count]) => count >= minCoupling)
        .map(([pair, count]) => {
          const [fileA, fileB] = pair.split('|||');
          
          // Coupling strength
          let coupling = 'weak';
          if (count > 15) coupling = 'strong';
          else if (count > 8) coupling = 'medium';
          
          return { fileA, fileB, timesChanged: count, coupling };
        })
        .sort((a, b) => b.timesChanged - a.timesChanged)
        .slice(0, 20);

      return couplings;
    } catch (error) {
      console.error('Error getting file coupling:', error);
      return null;
    }
  }

  /**
   * Get blame/ownership info for a file
   */
  getBlame(filepath: string): Array<{ author: string; lines: number; percentage: number; lastEdit: string }> | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      // Get blame with author info
      const output = this.exec(`git blame --line-porcelain "${filepath}"`);
      const lines = output.split('\n');

      // Parse blame output
      const authorLines = new Map<string, number>();
      const authorDates = new Map<string, string>();
      let currentAuthor = '';
      let totalLines = 0;

      for (const line of lines) {
        if (line.startsWith('author ')) {
          currentAuthor = line.substring(7);
          authorLines.set(currentAuthor, (authorLines.get(currentAuthor) || 0) + 1);
          totalLines++;
        } else if (line.startsWith('author-time ')) {
          const timestamp = parseInt(line.substring(12)) * 1000;
          const existing = authorDates.get(currentAuthor);
          if (!existing || timestamp > new Date(existing).getTime()) {
            authorDates.set(currentAuthor, new Date(timestamp).toISOString());
          }
        }
      }

      // Calculate percentages and format
      const ownership = Array.from(authorLines.entries())
        .map(([author, lines]) => {
          const percentage = Math.round((lines / totalLines) * 100);
          const lastEditISO = authorDates.get(author) || '';
          const lastEdit = lastEditISO ? this.formatRelativeTime(lastEditISO) : 'unknown';
          
          return { author, lines, percentage, lastEdit };
        })
        .sort((a, b) => b.lines - a.lines);

      return ownership;
    } catch (error) {
      console.error('Error getting blame:', error);
      return null;
    }
  }

  /**
   * Get comprehensive git analysis (combines hotspots, coupling, and more)
   */
  getAnalysis(): {
    hotspots: Array<{ file: string; changes: number; lastChanged: string; risk: string }>;
    coupling: Array<{ fileA: string; fileB: string; timesChanged: number; coupling: string }>;
    contributors: Array<{ name: string; commits: number; lastCommit: string }>;
    branchHealth: { current: string; behind: number; ahead: number; stale: boolean };
  } | null {
    if (!this.isGitRepo()) {
      return null;
    }

    try {
      const hotspots = this.getHotspots(10) || [];
      const coupling = this.getFileCoupling(3) || [];
      
      // Get contributor activity
      const contributorOutput = this.exec('git shortlog -sn --since="6 months ago"');
      const contributors = contributorOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.trim().match(/(\d+)\s+(.+)/);
          if (!match) return null;
          
          const commits = parseInt(match[1]);
          const name = match[2];
          
          // Get last commit date for this author
          const lastCommitOutput = this.exec(`git log -1 --author="${name}" --format="%ar"`);
          const lastCommit = lastCommitOutput.trim();
          
          return { name, commits, lastCommit };
        })
        .filter(c => c !== null) as Array<{ name: string; commits: number; lastCommit: string }>;

      // Branch health
      const status = this.getStatus();
      const branchHealth = {
        current: status?.branch || 'unknown',
        behind: status?.behind || 0,
        ahead: status?.ahead || 0,
        stale: (status?.behind || 0) > 10
      };

      return { hotspots, coupling, contributors, branchHealth };
    } catch (error) {
      console.error('Error getting git analysis:', error);
      return null;
    }
  }

  /**
   * Format relative time from ISO string
   */
  private formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
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
