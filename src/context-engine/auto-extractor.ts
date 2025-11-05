/**
 * Auto Context Extractor - Automatically extract context from various sources
 * 
 * Solves: Users manually maintaining context files
 * This watches for changes and auto-extracts relevant context
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface ExtractedContext {
  type: 'code_change' | 'conversation' | 'decision' | 'documentation';
  source: string;
  content: string;
  confidence: number; // 0-100
  metadata: {
    files?: string[];
    functions?: string[];
    keywords?: string[];
    timestamp: Date;
  };
}

export class AutoContextExtractor extends EventEmitter {
  private fileWatchers: Map<string, fsSync.FSWatcher> = new Map();
  private watchedFiles: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Extract context from git commit
   */
  async extractFromCommit(
    commitMessage: string,
    changedFiles: string[],
    diff: string
  ): Promise<ExtractedContext[]> {
    
    const contexts: ExtractedContext[] = [];
    
    // Extract architectural decisions from commit message
    if (this.isArchitecturalDecision(commitMessage)) {
      contexts.push({
        type: 'decision',
        source: 'git_commit',
        content: this.extractDecisionFromCommit(commitMessage, diff),
        confidence: 85,
        metadata: {
          files: changedFiles,
          functions: this.extractFunctionsFromDiff(diff),
          keywords: this.extractKeywords(commitMessage),
          timestamp: new Date(),
        },
      });
    }
    
    // Extract code patterns
    const patterns = this.extractCodePatterns(diff);
    if (patterns.length > 0) {
      contexts.push({
        type: 'code_change',
        source: 'git_diff',
        content: `Code patterns: ${patterns.join(', ')}`,
        confidence: 70,
        metadata: {
          files: changedFiles,
          keywords: patterns,
          timestamp: new Date(),
        },
      });
    }
    
    return contexts;
  }

  /**
   * Extract context from conversation
   */
  async extractFromConversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<ExtractedContext[]> {
    
    const contexts: ExtractedContext[] = [];
    
    for (const msg of messages) {
      // Extract decisions
      const decisions = this.extractDecisions(msg.content);
      contexts.push(...decisions.map(d => ({
        type: 'decision' as const,
        source: 'conversation',
        content: d,
        confidence: 75,
        metadata: {
          keywords: this.extractKeywords(d),
          timestamp: new Date(),
        },
      })));
      
      // Extract code references
      const codeRefs = this.extractCodeReferences(msg.content);
      if (codeRefs.length > 0) {
        contexts.push({
          type: 'code_change',
          source: 'conversation',
          content: `Discussed: ${codeRefs.join(', ')}`,
          confidence: 60,
          metadata: {
            files: codeRefs.filter(ref => ref.includes('.')),
            keywords: codeRefs,
            timestamp: new Date(),
          },
        });
      }
    }
    
    return contexts;
  }

  /**
   * Extract context from code file
   */
  async extractFromFile(filePath: string): Promise<ExtractedContext[]> {
    const contexts: ExtractedContext[] = [];
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract from comments
    const comments = this.extractComments(content, filePath);
    const docComments = comments.filter(c => this.isDocumentation(c));
    
    if (docComments.length > 0) {
      contexts.push({
        type: 'documentation',
        source: filePath,
        content: docComments.join('\n\n'),
        confidence: 90,
        metadata: {
          files: [filePath],
          functions: this.extractFunctionNames(content),
          timestamp: new Date(),
        },
      });
    }
    
    // Extract architectural patterns
    const patterns = this.detectPatterns(content, filePath);
    if (patterns.length > 0) {
      contexts.push({
        type: 'code_change',
        source: filePath,
        content: `Patterns used: ${patterns.join(', ')}`,
        confidence: 80,
        metadata: {
          files: [filePath],
          keywords: patterns,
          timestamp: new Date(),
        },
      });
    }
    
    return contexts;
  }

  /**
   * Watch directory for changes and auto-extract
   */
  async watchDirectory(dirPath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(dirPath);
      
      if (this.fileWatchers.has(resolvedPath)) {
        this.emit('warning', `Directory ${resolvedPath} is already being watched`);
        return;
      }

      // Check if directory exists
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error(`${resolvedPath} is not a directory`);
      }

      // Set up recursive file watcher
      const watcher = fsSync.watch(resolvedPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        const fullPath = path.join(resolvedPath, filename);
        this.handleFileChange(eventType, fullPath);
      });

      this.fileWatchers.set(resolvedPath, watcher);
      
      // Also watch for new files in subdirectories
      await this.setupDeepWatch(resolvedPath);
      
      this.emit('watching', { path: resolvedPath, type: 'directory' });
      
    } catch (error) {
      this.emit('error', { type: 'watch_setup_error', error, path: dirPath });
      throw error;
    }
  }

  /**
   * Watch specific file for changes
   */
  async watchFile(filePath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(filePath);
      
      if (this.watchedFiles.has(resolvedPath)) {
        return; // Already watching
      }

      // Check if file exists
      await fs.access(resolvedPath);

      const watcher = fsSync.watch(resolvedPath, (eventType) => {
        this.handleFileChange(eventType, resolvedPath);
      });

      this.fileWatchers.set(resolvedPath, watcher);
      this.watchedFiles.add(resolvedPath);
      
      this.emit('watching', { path: resolvedPath, type: 'file' });
      
    } catch (error) {
      this.emit('error', { type: 'file_watch_error', error, path: filePath });
      throw error;
    }
  }

  /**
   * Handle file system changes
   */
  private handleFileChange(eventType: string, filePath: string): void {
    // Debounce rapid file changes
    const debounceKey = filePath;
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
    }

    this.debounceTimers.set(debounceKey, setTimeout(async () => {
      try {
        await this.processFileChange(eventType, filePath);
      } catch (error) {
        this.emit('error', { type: 'file_process_error', error, path: filePath });
      } finally {
        this.debounceTimers.delete(debounceKey);
      }
    }, 300)); // 300ms debounce
  }

  /**
   * Process a file change and extract context
   */
  private async processFileChange(eventType: string, filePath: string): Promise<void> {
    // Only process certain file types
    const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.md', '.txt', '.json', '.yaml', '.yml'];
    
    const ext = path.extname(filePath).toLowerCase();
    if (!relevantExtensions.includes(ext)) {
      return;
    }

    // Skip certain directories
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__'];
    if (ignoreDirs.some(dir => filePath.includes(path.sep + dir + path.sep))) {
      return;
    }

    this.emit('file-change-detected', { eventType, path: filePath });

    try {
      // Check if file still exists (might have been deleted)
      await fs.access(filePath);
      
      // Extract context from the changed file
      const contexts = await this.extractFromFile(filePath);
      
      if (contexts.length > 0) {
        this.emit('context-extracted', {
          source: 'file_watcher',
          path: filePath,
          eventType,
          contexts
        });

        // Also emit each context individually
        for (const context of contexts) {
          this.emit('context-item-extracted', context);
        }
      }

    } catch (error) {
      if ((error as any).code !== 'ENOENT') { // Ignore file not found errors
        this.emit('extraction-error', { error, path: filePath });
      }
    }
  }

  /**
   * Set up deep watching for nested directories
   */
  private async setupDeepWatch(basePath: string): Promise<void> {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(basePath, entry.name);
          
          // Skip ignored directories
          const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', 'target', 'bin', 'obj'];
          if (ignoreDirs.includes(entry.name)) {
            continue;
          }

          // Recursively set up watching for subdirectories
          await this.setupDeepWatch(dirPath);
        }
      }
    } catch (error) {
      // Ignore errors for directories we can't read
    }
  }

  /**
   * Stop watching a path
   */
  public stopWatching(watchPath: string): void {
    const resolvedPath = path.resolve(watchPath);
    
    const watcher = this.fileWatchers.get(resolvedPath);
    if (watcher) {
      watcher.close();
      this.fileWatchers.delete(resolvedPath);
      this.watchedFiles.delete(resolvedPath);
      
      this.emit('stopped-watching', resolvedPath);
    }
  }

  /**
   * Stop all file watchers
   */
  public stopAllWatchers(): void {
    for (const [path, watcher] of this.fileWatchers) {
      watcher.close();
      this.emit('stopped-watching', path);
    }
    
    this.fileWatchers.clear();
    this.watchedFiles.clear();
    
    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    this.emit('all-watchers-stopped');
  }

  /**
   * Get information about active watchers
   */
  public getWatcherInfo(): { paths: string[]; count: number } {
    return {
      paths: Array.from(this.fileWatchers.keys()),
      count: this.fileWatchers.size
    };
  }

  /**
   * Watch multiple paths (files or directories) at once
   */
  public async watchMultiplePaths(paths: string[]): Promise<void> {
    const results = await Promise.allSettled(
      paths.map(async (pathToWatch) => {
        try {
          const stats = await fs.stat(pathToWatch);
          if (stats.isDirectory()) {
            return await this.watchDirectory(pathToWatch);
          } else {
            return await this.watchFile(pathToWatch);
          }
        } catch (error) {
          this.emit('error', { 
            type: 'multi_watch_error', 
            error, 
            path: pathToWatch 
          });
          throw error;
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      this.emit('warning', `Failed to watch ${failures.length} out of ${paths.length} paths`);
    }

    this.emit('multi-watch-complete', {
      total: paths.length,
      success: results.length - failures.length,
      failed: failures.length
    });
  }

  /**
   * Auto-watch important project files based on project structure
   */
  public async autoWatchProject(projectRoot: string): Promise<void> {
    try {
      const importantPaths: string[] = [];
      
      // Common important directories to watch
      const dirsToWatch = ['src', 'lib', 'app', 'components', 'pages', 'api', 'utils', 'hooks'];
      
      for (const dir of dirsToWatch) {
        const dirPath = path.join(projectRoot, dir);
        try {
          await fs.access(dirPath);
          importantPaths.push(dirPath);
        } catch {
          // Directory doesn't exist, skip it
        }
      }

      // Important config files to watch
      const configFiles = [
        'package.json', 'tsconfig.json', 'next.config.js', 'vite.config.ts',
        'webpack.config.js', 'babel.config.js', '.env', '.env.local'
      ];
      
      for (const file of configFiles) {
        const filePath = path.join(projectRoot, file);
        try {
          await fs.access(filePath);
          importantPaths.push(filePath);
        } catch {
          // File doesn't exist, skip it
        }
      }

      if (importantPaths.length > 0) {
        // Perform an initial extraction pass so callers using "auto" get immediate contexts
        // (previously we only set up watchers which could explain "no contexts extracted from auto").
        try {
          await this.extractInitialContexts(importantPaths);
        } catch (err) {
          // non-fatal; continue to set up watchers
          this.emit('warning', { type: 'initial_extract_failed', error: err });
        }

        await this.watchMultiplePaths(importantPaths);
        this.emit('auto-watch-complete', {
          projectRoot,
          watchedPaths: importantPaths
        });
      } else {
        this.emit('warning', `No standard project structure found in ${projectRoot}`);
      }
      
    } catch (error) {
      this.emit('error', { 
        type: 'auto_watch_error', 
        error, 
        projectRoot 
      });
      throw error;
    }
  }

  /**
   * Run an initial extraction pass over the provided paths.
   * Walks directories and extracts from files with relevant extensions.
   */
  private async extractInitialContexts(pathsToScan: string[]): Promise<void> {
    const relevantExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.md', '.txt', '.json', '.yaml', '.yml']);

    const walkAndCollect = async (p: string) => {
      try {
        const stats = await fs.stat(p);
        if (stats.isDirectory()) {
          const entries = await fs.readdir(p, { withFileTypes: true });
          for (const entry of entries) {
            // Skip ignored directories
            if (entry.isDirectory()) {
              const name = entry.name;
              const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', 'target', 'bin', 'obj'];
              if (ignoreDirs.includes(name)) continue;
              await walkAndCollect(path.join(p, name));
            } else if (entry.isFile()) {
              const entryPath = path.join(p, entry.name);
              const ext = path.extname(entry.name).toLowerCase();
              if (relevantExtensions.has(ext)) {
                try {
                  const contexts = await this.extractFromFile(entryPath);
                  if (contexts.length > 0) {
                    this.emit('context-extracted', { source: 'initial-scan', path: entryPath, contexts });
                    for (const c of contexts) this.emit('context-item-extracted', c);
                  }
                } catch (err) {
                  this.emit('extraction-error', { path: entryPath, error: err });
                }
              }
            }
          }
        } else if (stats.isFile()) {
          const ext = path.extname(p).toLowerCase();
          if (relevantExtensions.has(ext)) {
            try {
              const contexts = await this.extractFromFile(p);
              if (contexts.length > 0) {
                this.emit('context-extracted', { source: 'initial-scan', path: p, contexts });
                for (const c of contexts) this.emit('context-item-extracted', c);
              }
            } catch (err) {
              this.emit('extraction-error', { path: p, error: err });
            }
          }
        }
      } catch (err) {
        // ignore unreadable entries
      }
    };

    // Run collection for each provided path
    for (const p of pathsToScan) {
      await walkAndCollect(p);
    }
  }

  // Helper methods
  
  private isArchitecturalDecision(message: string): boolean {
    const keywords = [
      'refactor', 'architecture', 'design', 'pattern',
      'chose', 'decided', 'implemented', 'migrated',
    ];
    return keywords.some(kw => message.toLowerCase().includes(kw));
  }

  private extractDecisionFromCommit(message: string, diff: string): string {
    // Extract the decision and reasoning
    const lines = message.split('\n');
    const decision = lines[0];
    const reasoning = lines.slice(1).join(' ').trim();
    
    return `${decision}${reasoning ? ` - ${reasoning}` : ''}`;
  }

  private extractFunctionsFromDiff(diff: string): string[] {
    const functionPattern = /(?:function|const|let|var)\s+(\w+)/g;
    const matches = [...diff.matchAll(functionPattern)];
    return [...new Set(matches.map(m => m[1]))];
  }

  private extractCodePatterns(diff: string): string[] {
    const patterns: string[] = [];
    
    if (diff.includes('async') && diff.includes('await')) patterns.push('async/await');
    if (diff.includes('useState') || diff.includes('useEffect')) patterns.push('React Hooks');
    if (diff.includes('class') && diff.includes('extends')) patterns.push('OOP');
    if (diff.includes('=>')) patterns.push('arrow functions');
    if (diff.includes('try') && diff.includes('catch')) patterns.push('error handling');
    
    return patterns;
  }

  private extractDecisions(text: string): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
      /we (?:should|will|decided to|chose to) (.+?)(?:\.|$)/gi,
      /(?:decision|chose|selected|picked) (.+?)(?:\.|$)/gi,
      /let's use (.+?)(?:\.|$)/gi,
    ];
    
    for (const pattern of decisionPatterns) {
      const matches = [...text.matchAll(pattern)];
      decisions.push(...matches.map(m => m[0]));
    }
    
    return decisions;
  }

  private extractCodeReferences(text: string): string[] {
    const refs: string[] = [];
    
    // Extract file names
    const filePattern = /\b[\w-]+\.(ts|js|tsx|jsx|py|java|go|rs)\b/g;
    refs.push(...(text.match(filePattern) || []));
    
    // Extract function names (camelCase)
    const funcPattern = /\b[a-z]+[A-Z]\w+\b/g;
    refs.push(...(text.match(funcPattern) || []));
    
    return [...new Set(refs)];
  }

  private extractComments(content: string, filePath: string): string[] {
    const ext = path.extname(filePath);
    let commentPattern: RegExp;
    
    if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) {
      commentPattern = /\/\*\*[\s\S]*?\*\/|\/\/.*/g;
    } else if (ext === '.py') {
      commentPattern = /"""[\s\S]*?"""|#.*/g;
    } else {
      return [];
    }
    
    return (content.match(commentPattern) || [])
      .map(c => c.replace(/^\/\*\*|\*\/$/g, '').trim())
      .filter(c => c.length > 10);
  }

  private isDocumentation(comment: string): boolean {
    return comment.length > 50 && 
           (comment.includes('@param') || comment.includes('@returns') || comment.includes('TODO'));
  }

  private extractFunctionNames(content: string): string[] {
    const funcPattern = /(?:function|const|let|var|async)\s+(\w+)/g;
    const matches = [...content.matchAll(funcPattern)];
    return matches.map(m => m[1]);
  }

  private detectPatterns(content: string, filePath: string): string[] {
    const patterns: string[] = [];
    
    if (content.includes('React.Component') || content.includes('useState')) patterns.push('React');
    if (content.includes('express()') || content.includes('app.listen')) patterns.push('Express');
    if (content.includes('interface') && filePath.endsWith('.ts')) patterns.push('TypeScript');
    if (content.includes('async') || content.includes('Promise')) patterns.push('Async Programming');
    
    return patterns;
  }

  private extractKeywords(text: string): string[] {
    // Extract important keywords (excluding common words)
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    return [...new Set(words.filter(w => 
      w.length > 3 && !stopWords.has(w)
    ))].slice(0, 10);
  }
}

export function createAutoContextExtractor(): AutoContextExtractor {
  return new AutoContextExtractor();
}