/**
 * Git Status Engine
 * 
 * Layer 1: Fast git status with categorization
 * Layer 2: Impact analysis and change classification
 * Layer 3: File complexity context for changed files
 * 
 * Features:
 * - Change categorization (features/bugs/refactors/docs)
 * - Impact scoring (high/medium/low)
 * - Complexity context for changed files
 * - Commit readiness assessment
 * - Smart warnings and suggestions
 */

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as path from 'path';
import { ReadFileEngine } from './read-file-engine.js';

interface FileChange {
  path: string;
  status: 'staged' | 'modified' | 'untracked' | 'deleted' | 'renamed';
  category?: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'config' | 'test' | 'other';
  impact?: 'high' | 'medium' | 'low';
  complexity?: string;
  linesOfCode?: number;
}

interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  clean: boolean;
  changes: {
    staged: FileChange[];
    modified: FileChange[];
    untracked: FileChange[];
    deleted: FileChange[];
    renamed: FileChange[];
  };
  summary: {
    totalChanges: number;
    highImpact: number;
    complexity: {
      high: number;
      medium: number;
      low: number;
    };
    categories: {
      [key: string]: number;
    };
  };
  commitReadiness: {
    ready: boolean;
    warnings: string[];
    suggestions: string[];
  };
}

export class GitStatusEngine {
  private git: SimpleGit;
  private workspacePath: string;
  private readFileEngine: ReadFileEngine;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.git = simpleGit(workspacePath);
    this.readFileEngine = new ReadFileEngine(workspacePath);
  }

  /**
   * Layer 1 + 2 + 3: Get enriched git status
   */
  async getStatus(options: {
    analyzeImpact?: boolean;
    enrichContext?: boolean;
  } = {}): Promise<GitStatusResult> {
    const {
      analyzeImpact = true,
      enrichContext = true
    } = options;

    // Layer 1: Get basic git status
    const status = await this.git.status();
    
    const result: GitStatusResult = {
      branch: status.current || 'unknown',
      ahead: status.ahead,
      behind: status.behind,
      clean: status.isClean(),
      changes: {
        staged: [],
        modified: [],
        untracked: [],
        deleted: [],
        renamed: []
      },
      summary: {
        totalChanges: 0,
        highImpact: 0,
        complexity: { high: 0, medium: 0, low: 0 },
        categories: {}
      },
      commitReadiness: {
        ready: false,
        warnings: [],
        suggestions: []
      }
    };

    // Process all changes
    await this.processChanges(status, result, analyzeImpact, enrichContext);

    // Calculate summary
    this.calculateSummary(result);

    // Assess commit readiness
    this.assessCommitReadiness(result);

    return result;
  }

  /**
   * Layer 2: Process and categorize changes
   */
  private async processChanges(
    status: StatusResult,
    result: GitStatusResult,
    analyzeImpact: boolean,
    enrichContext: boolean
  ): Promise<void> {
    // Staged files
    for (const file of status.staged) {
      const change = await this.analyzeChange(file, 'staged', analyzeImpact, enrichContext);
      result.changes.staged.push(change);
    }

    // Modified files
    for (const file of status.modified) {
      const change = await this.analyzeChange(file, 'modified', analyzeImpact, enrichContext);
      result.changes.modified.push(change);
    }

    // Untracked files
    for (const file of status.not_added) {
      const change = await this.analyzeChange(file, 'untracked', analyzeImpact, enrichContext);
      result.changes.untracked.push(change);
    }

    // Deleted files
    for (const file of status.deleted) {
      const change: FileChange = {
        path: file,
        status: 'deleted',
        category: this.categorizeFile(file),
        impact: 'medium'
      };
      result.changes.deleted.push(change);
    }

    // Renamed files
    for (const file of status.renamed) {
      const change = await this.analyzeChange(file.to || file.from, 'renamed', analyzeImpact, enrichContext);
      result.changes.renamed.push(change);
    }
  }

  /**
   * Layer 2 + 3: Analyze individual change
   */
  private async analyzeChange(
    filePath: string,
    status: FileChange['status'],
    analyzeImpact: boolean,
    enrichContext: boolean
  ): Promise<FileChange> {
    const change: FileChange = {
      path: filePath,
      status
    };

    // Layer 2: Categorize and assess impact
    if (analyzeImpact) {
      change.category = this.categorizeFile(filePath);
      change.impact = this.assessImpact(filePath, change.category);
    }

    // Layer 3: Enrich with file complexity context
    if (enrichContext && status !== 'deleted' && this.isCodeFile(filePath)) {
      try {
        const fullPath = path.join(this.workspacePath, filePath);
        const fileCtx = await this.readFileEngine.read(fullPath);
        change.complexity = fileCtx.complexity.level;
        change.linesOfCode = fileCtx.metadata.linesOfCode;
      } catch (err) {
        // Skip files that can't be analyzed
      }
    }

    return change;
  }

  /**
   * Layer 2: Categorize file by path and name
   */
  private categorizeFile(filePath: string): FileChange['category'] {
    const lower = filePath.toLowerCase();
    
    // Tests
    if (lower.includes('test') || lower.includes('spec') || lower.includes('__tests__')) {
      return 'test';
    }
    
    // Docs
    if (lower.endsWith('.md') || lower.includes('doc') || lower.includes('readme')) {
      return 'docs';
    }
    
    // Config
    if (
      lower.includes('config') ||
      lower.endsWith('.json') ||
      lower.endsWith('.yaml') ||
      lower.endsWith('.yml') ||
      lower.endsWith('.toml') ||
      lower.endsWith('.env')
    ) {
      return 'config';
    }
    
    // Try to infer from common patterns
    if (lower.includes('fix') || lower.includes('bug')) {
      return 'bugfix';
    }
    
    if (lower.includes('refactor') || lower.includes('cleanup')) {
      return 'refactor';
    }
    
    // Default to feature for code files
    if (this.isCodeFile(filePath)) {
      return 'feature';
    }
    
    return 'other';
  }

  /**
   * Layer 2: Assess impact of change
   */
  private assessImpact(filePath: string, category?: FileChange['category']): FileChange['impact'] {
    const lower = filePath.toLowerCase();
    
    // High impact files
    if (
      lower.includes('index') ||
      lower.includes('main') ||
      lower.includes('server') ||
      lower.includes('app') ||
      lower.includes('core') ||
      lower.includes('engine') ||
      lower.includes('database') ||
      lower.includes('migration')
    ) {
      return 'high';
    }
    
    // Low impact files
    if (
      category === 'docs' ||
      category === 'test' ||
      lower.includes('util') ||
      lower.includes('helper') ||
      lower.includes('type')
    ) {
      return 'low';
    }
    
    // Medium by default
    return 'medium';
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(result: GitStatusResult): void {
    const allChanges = [
      ...result.changes.staged,
      ...result.changes.modified,
      ...result.changes.untracked,
      ...result.changes.deleted,
      ...result.changes.renamed
    ];

    result.summary.totalChanges = allChanges.length;

    for (const change of allChanges) {
      // Count high impact
      if (change.impact === 'high') {
        result.summary.highImpact++;
      }

      // Count complexity
      if (change.complexity) {
        if (change.complexity === 'low') result.summary.complexity.low++;
        else if (change.complexity === 'medium') result.summary.complexity.medium++;
        else if (change.complexity === 'high' || change.complexity === 'very-high') {
          result.summary.complexity.high++;
        }
      }

      // Count categories
      if (change.category) {
        result.summary.categories[change.category] = 
          (result.summary.categories[change.category] || 0) + 1;
      }
    }
  }

  /**
   * Layer 3: Assess commit readiness
   */
  private assessCommitReadiness(result: GitStatusResult): void {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check if there are staged changes
    if (result.changes.staged.length === 0) {
      warnings.push('No files staged for commit');
      if (result.changes.modified.length > 0 || result.changes.untracked.length > 0) {
        suggestions.push('Stage files with git add before committing');
      }
    }

    // Check for high impact changes
    const stagedHighImpact = result.changes.staged.filter(c => c.impact === 'high').length;
    if (stagedHighImpact > 0) {
      warnings.push(`${stagedHighImpact} high-impact file(s) staged - review carefully`);
      suggestions.push('Consider splitting high-impact changes into separate commits');
    }

    // Check for very complex files
    const complexFiles = result.changes.staged.filter(c => 
      c.complexity === 'high' || c.complexity === 'very-high'
    ).length;
    if (complexFiles > 0) {
      suggestions.push(`${complexFiles} complex file(s) changed - ensure adequate testing`);
    }

    // Check for mixed categories
    const categories = new Set(result.changes.staged.map(c => c.category));
    if (categories.size > 2) {
      suggestions.push('Multiple change types staged - consider separate commits for clarity');
    }

    // Check if working tree is clean except staged
    const hasUnstagedChanges = 
      result.changes.modified.length > 0 || 
      result.changes.untracked.length > 0;
    if (hasUnstagedChanges) {
      suggestions.push('Unstaged changes present - consider stashing or committing separately');
    }

    // Ready if staged files exist and no critical warnings
    result.commitReadiness.ready = 
      result.changes.staged.length > 0 && 
      warnings.filter(w => w.includes('review carefully')).length === 0;

    result.commitReadiness.warnings = warnings;
    result.commitReadiness.suggestions = suggestions;
  }

  /**
   * Helper: Check if code file
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

