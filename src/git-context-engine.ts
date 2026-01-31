/**
 * Git Context Engine
 * 
 * Layer 1: Fast git context retrieval
 * Layer 2: Smart commit message generation
 * Layer 3: File complexity integration for context-aware commits
 * 
 * Features:
 * - Automatic commit message generation
 * - Conventional commits format support
 * - Diff analysis for message context
 * - File complexity awareness
 * - Smart suggestions based on changes
 */

import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
import * as path from 'path';
import { ReadFileEngine } from './read-file-engine.js';

interface GitContext {
  branch: string;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  } | null;
  uncommittedFiles: string[];
  stagedFiles: string[];
  ahead: number;
  behind: number;
  suggestedCommitMessage?: string;
  changeAnalysis?: {
    filesChanged: number;
    insertions: number;
    deletions: number;
    categories: {
      [key: string]: number;
    };
    primaryCategory?: string;
    scope?: string;
  };
}

export class GitContextEngine {
  private git: SimpleGit;
  private workspacePath: string;
  private readFileEngine: ReadFileEngine;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.git = simpleGit(workspacePath);
    this.readFileEngine = new ReadFileEngine(workspacePath);
  }

  /**
   * Layer 1 + 2 + 3: Get enriched git context with smart commit message
   */
  async getContext(options: {
    generateCommitMessage?: boolean;
    analyzeChanges?: boolean;
  } = {}): Promise<GitContext> {
    const {
      generateCommitMessage = true,
      analyzeChanges = true
    } = options;

    // Layer 1: Get basic git context
    const status = await this.git.status();
    const logs = await this.git.log({ maxCount: 1 });
    
    const context: GitContext = {
      branch: status.current || 'unknown',
      lastCommit: null,
      uncommittedFiles: [...status.modified, ...status.not_added],
      stagedFiles: status.staged,
      ahead: status.ahead,
      behind: status.behind
    };

    // Get last commit info
    if (logs.latest) {
      context.lastCommit = {
        hash: logs.latest.hash.substring(0, 7),
        message: logs.latest.message,
        author: logs.latest.author_name,
        date: new Date(logs.latest.date)
      };
    }

    // Layer 2: Analyze changes if requested
    if (analyzeChanges && context.stagedFiles.length > 0) {
      context.changeAnalysis = await this.analyzeChanges(context.stagedFiles);
    }

    // Layer 3: Generate smart commit message
    if (generateCommitMessage && context.stagedFiles.length > 0 && context.changeAnalysis) {
      context.suggestedCommitMessage = await this.generateCommitMessage(
        context.stagedFiles,
        context.changeAnalysis
      );
    }

    return context;
  }

  /**
   * Layer 2: Analyze changes with diff
   */
  private async analyzeChanges(stagedFiles: string[]): Promise<GitContext['changeAnalysis']> {
    const categories: { [key: string]: number } = {};
    let insertions = 0;
    let deletions = 0;

    // Get diff summary for staged changes
    try {
      const diffSummary = await this.git.diffSummary(['--cached']);
      insertions = diffSummary.insertions;
      deletions = diffSummary.deletions;
    } catch (err) {
      // If diff fails, use defaults
    }

    // Categorize files
    for (const file of stagedFiles) {
      const category = this.categorizeFile(file);
      categories[category] = (categories[category] || 0) + 1;
    }

    // Determine primary category
    const primaryCategory = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'chore';

    // Determine scope from file paths
    const scope = this.determineScope(stagedFiles);

    return {
      filesChanged: stagedFiles.length,
      insertions,
      deletions,
      categories,
      primaryCategory,
      scope
    };
  }

  /**
   * Layer 3: Generate smart commit message using file complexity context
   */
  private async generateCommitMessage(
    stagedFiles: string[],
    analysis: GitContext['changeAnalysis']
  ): Promise<string> {
    if (!analysis) return '';

    const { primaryCategory, scope, filesChanged } = analysis;

    // Analyze first few staged files for context
    const fileContexts: Array<{
      name: string;
      complexity?: string;
      isNew: boolean;
    }> = [];

    for (const file of stagedFiles.slice(0, 3)) {
      const isNew = await this.isNewFile(file);
      const ctx: { name: string; complexity?: string; isNew: boolean } = {
        name: path.basename(file),
        isNew
      };

      // Get complexity for code files
      if (this.isCodeFile(file) && !isNew) {
        try {
          const fullPath = path.join(this.workspacePath, file);
          const fileCtx = await this.readFileEngine.read(fullPath);
          ctx.complexity = fileCtx.complexity.level;
        } catch (err) {
          // Skip complexity if can't read
        }
      }

      fileContexts.push(ctx);
    }

    // Generate message using conventional commits format
    let message = this.getCommitType(primaryCategory || 'chore');
    
    if (scope) {
      message += `(${scope})`;
    }
    
    message += ': ';

    // Generate description based on files and analysis
    const descriptions: string[] = [];

    // Handle new files
    const newFiles = fileContexts.filter(f => f.isNew);
    if (newFiles.length > 0) {
      descriptions.push(`add ${newFiles.map(f => f.name).join(', ')}`);
    }

    // Handle existing files
    const modifiedFiles = fileContexts.filter(f => !f.isNew);
    if (modifiedFiles.length > 0) {
      const complexFiles = modifiedFiles.filter(f => 
        f.complexity === 'high' || f.complexity === 'very-high'
      );

      if (complexFiles.length > 0) {
        descriptions.push(`refactor ${complexFiles.map(f => f.name).join(', ')}`);
      } else if (primaryCategory === 'feature') {
        descriptions.push(`enhance ${modifiedFiles.map(f => f.name).join(', ')}`);
      } else if (primaryCategory === 'bugfix') {
        descriptions.push(`fix issues in ${modifiedFiles.map(f => f.name).join(', ')}`);
      } else {
        descriptions.push(`update ${modifiedFiles.map(f => f.name).join(', ')}`);
      }
    }

    if (descriptions.length === 0) {
      // Fallback generic message
      descriptions.push(`update ${filesChanged} file${filesChanged > 1 ? 's' : ''}`);
    }

    message += descriptions.join(' and ');

    // Add line count context if significant
    if (analysis.insertions > 100 || analysis.deletions > 100) {
      message += `\n\n+${analysis.insertions} -${analysis.deletions} lines changed`;
    }

    return message;
  }

  /**
   * Categorize file by path and name
   */
  private categorizeFile(filePath: string): string {
    const lower = filePath.toLowerCase();
    
    if (lower.includes('test') || lower.includes('spec')) return 'test';
    if (lower.endsWith('.md') || lower.includes('doc')) return 'docs';
    if (lower.includes('config') || lower.endsWith('.json') || lower.endsWith('.yaml')) return 'config';
    if (lower.includes('fix') || lower.includes('bug')) return 'bugfix';
    if (lower.includes('refactor')) return 'refactor';
    if (this.isCodeFile(filePath)) return 'feature';
    
    return 'chore';
  }

  /**
   * Determine scope from file paths
   */
  private determineScope(files: string[]): string | undefined {
    // Extract common directory or module name
    const dirs = files.map(f => {
      const parts = f.split(/[/\\]/);
      return parts.length > 1 ? parts[0] : null;
    }).filter(Boolean);

    if (dirs.length === 0) return undefined;

    // Find most common directory
    const dirCounts: { [key: string]: number } = {};
    for (const dir of dirs) {
      if (dir) dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    }

    const mostCommon = Object.entries(dirCounts)
      .sort(([, a], [, b]) => b - a)[0];

    if (mostCommon && mostCommon[1] >= files.length * 0.5) {
      return mostCommon[0];
    }

    return undefined;
  }

  /**
   * Get conventional commit type
   */
  private getCommitType(category: string): string {
    const typeMap: { [key: string]: string } = {
      'feature': 'feat',
      'bugfix': 'fix',
      'docs': 'docs',
      'test': 'test',
      'refactor': 'refactor',
      'config': 'chore',
      'other': 'chore'
    };

    return typeMap[category] || 'chore';
  }

  /**
   * Check if file is new (untracked)
   */
  private async isNewFile(filePath: string): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.not_added.includes(filePath);
    } catch (err) {
      return false;
    }
  }

  /**
   * Check if code file
   */
  private isCodeFile(filePath: string): boolean {
    const extensions = [
      '.ts', '.js', '.tsx', '.jsx',
      '.py', '.go', '.rs', '.java',
      '.cpp', '.c', '.h'
    ];
    return extensions.some(ext => filePath.endsWith(ext));
  }
}

