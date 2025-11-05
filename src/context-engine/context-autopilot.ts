/**
 * Context Autopilot - Fully automatic context management
 * 
 * THE KILLER FEATURE: Users never manage context manually again
 */

import { RelevanceScorer } from './relevance-scorer.js';
import { ContextCompressor } from './context-compressor.js';
import { AutoContextExtractor } from './auto-extractor.js';
import { ContextHealthMonitor } from './health-monitor.js';
import { EventEmitter } from 'events';
import { ContextItem } from './relevance-scorer.js';
import { GitIntegration, GitStatus } from '../git-integration.js';
import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '../storage.js';

export interface AutopilotConfig {
  maxContextTokens: number;
  relevanceThreshold: number;
  autoExtractFromGit: boolean;
  autoExtractFromConversations: boolean;
  autoCompression: boolean;
  healthCheckInterval: number; // minutes
}

export class ContextAutopilot extends EventEmitter {
  private scorer: RelevanceScorer;
  private compressor: ContextCompressor;
  private extractor: AutoContextExtractor;
  private healthMonitor: ContextHealthMonitor;
  private config: AutopilotConfig;
  private gitIntegration: GitIntegration;
  private gitWatcher?: NodeJS.Timeout;
  private healthMonitorInterval?: NodeJS.Timeout;
  private lastKnownCommit?: string;
  private workspacePath: string;
  private storage: Storage;

  constructor(workspacePath: string, config: Partial<AutopilotConfig> = {}, storage?: Storage) {
    super();
    this.workspacePath = workspacePath;
    this.scorer = new RelevanceScorer();
    this.compressor = new ContextCompressor();
    this.extractor = new AutoContextExtractor();
    this.healthMonitor = new ContextHealthMonitor(workspacePath);
    this.gitIntegration = new GitIntegration(workspacePath);
    this.storage = storage || new Storage();
    
    this.config = {
      maxContextTokens: 8000,
      relevanceThreshold: 40,
      autoExtractFromGit: true,
      autoExtractFromConversations: true,
      autoCompression: true,
      healthCheckInterval: 60,
      ...config,
    };
  }

  /**
   * Start the autopilot - fully automatic context management
   */
  async start(): Promise<void> {
    this.emit('started', this.config);
    
    // Set up automatic extraction
    if (this.config.autoExtractFromGit) {
      await this.setupGitWatcher();
    }
    
    // Set up health monitoring
    this.startHealthMonitoring();
    
    this.emit('autopilot-enabled');
  }

  /**
   * Get optimal context for current task
   */
  async getOptimalContext(
    currentFiles: string[],
    conversation: string[],
    taskDescription?: string
  ): Promise<ContextItem[]> {
    
    // 1. Get all available context
    const allContext = await this.loadAllContext();
    
    // 2. Score for relevance
    const scoringContext = {
      currentFiles,
      recentConversation: conversation,
      activeKeywords: this.extractKeywords(conversation.join(' ')),
      timeWindow: new Date(),
      taskDescription,
    };
    
    const scored = await this.scorer.scoreAndRank(allContext, scoringContext);
    
    // 3. Filter by threshold
    const relevant = scored.filter(
      item => item.relevanceScore.score >= this.config.relevanceThreshold
    );
    
    // 4. Compress if needed
    if (this.config.autoCompression) {
      const result = await this.compressor.compress(
        relevant,
        this.config.maxContextTokens,
        { name: 'balanced', targetReduction: 0.5, preserveTypes: ['decision'] }
      );
      
      this.emit('context-compressed', result);
      return result.compressed;
    }
    
    return relevant;
  }

  /**
   * Auto-extract context from git activity
   */
  private async setupGitWatcher(): Promise<void> {
    if (!this.gitIntegration.isGitRepo()) {
      this.emit('git-watcher-skipped', 'Not a git repository');
      return;
    }

    // Get initial commit hash
    try {
      this.lastKnownCommit = await this.getCurrentCommitHash();
    } catch (error) {
      this.emit('git-watcher-error', error);
      return;
    }

    // Set up polling for git changes
    this.gitWatcher = setInterval(async () => {
      try {
        await this.checkForGitChanges();
      } catch (error) {
        this.emit('git-watcher-error', error);
      }
    }, 5000); // Poll every 5 seconds

    this.emit('git-watcher-started', { interval: 5000 });
  }

  /**
   * Check for git changes and extract context from modified files
   */
  private async checkForGitChanges(): Promise<void> {
    const currentCommit = await this.getCurrentCommitHash();
    
    if (currentCommit !== this.lastKnownCommit) {
      this.emit('git-change-detected', { 
        oldCommit: this.lastKnownCommit, 
        newCommit: currentCommit 
      });

      // Get changed files since last known commit
      const changedFiles = await this.getChangedFilesSinceCommit(this.lastKnownCommit!);
      
      // Extract context from changed files
      for (const file of changedFiles) {
        try {
          const context = await this.extractor.extractFromFile(file);
          if (context.length > 0) {
            this.emit('context-extracted', { file, context });
          }
        } catch (error) {
          this.emit('extraction-error', { file, error });
        }
      }

      this.lastKnownCommit = currentCommit;
    }

    // Also check working directory changes
    const status = this.gitIntegration.getStatus();
    if (status && !status.clean) {
      const modifiedFiles = [...status.modified, ...status.staged];
      for (const file of modifiedFiles) {
        try {
          const fullPath = path.resolve(this.workspacePath, file);
          const context = await this.extractor.extractFromFile(fullPath);
          if (context.length > 0) {
            this.emit('working-dir-context-extracted', { file, context });
          }
        } catch (error) {
          this.emit('extraction-error', { file, error });
        }
      }
    }
  }

  /**
   * Get current commit hash
   */
  private async getCurrentCommitHash(): Promise<string> {
    try {
      const { execSync } = require('child_process');
      const result = execSync('git rev-parse HEAD', { 
        cwd: this.workspacePath,
        encoding: 'utf8'
      });
      return result.trim();
    } catch (error) {
      throw new Error(`Failed to get current commit hash: ${error}`);
    }
  }

  /**
   * Get list of files changed since a specific commit
   */
  private async getChangedFilesSinceCommit(commitHash: string): Promise<string[]> {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`git diff --name-only ${commitHash} HEAD`, {
        cwd: this.workspacePath,
        encoding: 'utf8'
      });
      
      return result
        .split('\n')
        .filter((file: string) => file.trim())
        .map((file: string) => path.resolve(this.workspacePath, file))
        .filter((file: string) => fs.existsSync(file)); // Only include files that still exist
    } catch (error) {
      this.emit('git-diff-error', error);
      return [];
    }
  }

  /**
   * Stop the git watcher
   */
  public stopGitWatcher(): void {
    if (this.gitWatcher) {
      clearInterval(this.gitWatcher);
      this.gitWatcher = undefined;
      this.emit('git-watcher-stopped');
    }
  }

  /**
   * Stop the autopilot and clean up resources
   */
  public stop(): void {
    this.stopGitWatcher();
    
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = undefined;
    }
    
    this.emit('stopped');
  }

  /**
   * Periodic health checks
   */
  private startHealthMonitoring(): void {
    this.healthMonitorInterval = setInterval(async () => {
      const allContext = await this.loadAllContext();
      const health = await this.healthMonitor.assessHealth(allContext);
      
      this.emit('health-check', health);
      
      if (health.score < 70) {
        this.emit('health-warning', health);
      }
    }, this.config.healthCheckInterval * 60 * 1000);
  }

  private async loadAllContext(): Promise<ContextItem[]> {
    // Load from storage if available
    try {
      const project = this.storage.getCurrentProject() || this.storage.findProjectByPath(this.workspacePath);
      if (!project) return [];

      const decisions = this.storage.getDecisions(project.id);
      const conversations = this.storage.getRecentConversations(project.id, 200);

      const items: ContextItem[] = [];

      for (const d of decisions) {
        const content = `${d.description}${d.reasoning ? '\n' + d.reasoning : ''}`;
        items.push({
          id: d.id,
          type: 'decision',
          content,
          timestamp: d.timestamp,
          metadata: { project: project.name },
          tokens: Math.max(1, Math.ceil(content.length / 4)),
        });
      }

      for (const c of conversations) {
        items.push({
          id: c.id,
          type: 'conversation',
          content: c.content,
          timestamp: c.timestamp,
          metadata: { project: project.name },
          tokens: Math.max(1, Math.ceil(c.content.length / 4)),
        });
      }

      return items;
    } catch (err) {
      this.emit('load-context-error', err);
      return [];
    }
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but']);
    return [...new Set(words.filter(w => w.length > 3 && !stopWords.has(w)))];
  }
}

export function createContextAutopilot(workspacePath: string, config?: Partial<AutopilotConfig>, storage?: import('../storage.js').Storage): ContextAutopilot {
  return new ContextAutopilot(workspacePath, config, storage);
}