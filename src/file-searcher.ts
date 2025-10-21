// File and Content Search Operations

import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceDetector } from './workspace-detector.js';

export interface FileMatch {
  path: string;
  name: string;
  size: number;
  language: string;
}

export interface ContentMatch {
  path: string;
  line: number;
  content: string;
  match: string;
  context: {
    before: string[];
    after: string[];
  };
}

export interface SearchOptions {
  maxResults?: number;
  ignoreCase?: boolean;
  filePattern?: string;
}

export interface ContentSearchOptions extends SearchOptions {
  regex?: boolean;
  caseSensitive?: boolean;
  contextLines?: number;
}

export class FileSearcher {
  constructor(private workspaceDetector: WorkspaceDetector) {}

  /**
   * Search for files by name or pattern
   */
  searchFiles(pattern: string, options: SearchOptions = {}): FileMatch[] {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return [];
    }

    const {
      maxResults = 50,
      ignoreCase = true,
      filePattern
    } = options;

    const results: FileMatch[] = [];
    const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;

    this.searchRecursive(
      workspace,
      searchPattern,
      results,
      maxResults,
      ignoreCase,
      filePattern
    );

    return results;
  }

  /**
   * Search file contents for text or regex
   */
  searchContent(
    query: string,
    options: ContentSearchOptions = {}
  ): ContentMatch[] {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return [];
    }

    const {
      maxResults = 100,
      regex = false,
      caseSensitive = false,
      contextLines = 2,
      filePattern
    } = options;

    const results: ContentMatch[] = [];
    const searchRegex = this.createSearchRegex(query, regex, caseSensitive);

    this.searchContentRecursive(
      workspace,
      searchRegex,
      results,
      maxResults,
      contextLines,
      filePattern
    );

    return results;
  }

  /**
   * Find symbol definitions (functions, classes, etc.)
   */
  findSymbol(symbol: string, type?: 'function' | 'class' | 'variable' | 'all'): ContentMatch[] {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return [];
    }

    const patterns = this.getSymbolPatterns(symbol, type || 'all');
    const results: ContentMatch[] = [];

    for (const pattern of patterns) {
      const matches = this.searchContent(pattern, {
        regex: true,
        caseSensitive: true,
        maxResults: 20
      });
      results.push(...matches);
    }

    return results;
  }

  /**
   * Get unique file extensions in workspace
   */
  getFileExtensions(): Map<string, number> {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return new Map();
    }

    const extensions = new Map<string, number>();
    this.countExtensions(workspace, extensions);
    return extensions;
  }

  /**
   * Get file statistics
   */
  getFileStats(): {
    totalFiles: number;
    totalSize: number;
    byExtension: Map<string, { count: number; size: number }>;
  } {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return { totalFiles: 0, totalSize: 0, byExtension: new Map() };
    }

    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byExtension: new Map<string, { count: number; size: number }>()
    };

    this.calculateStats(workspace, stats);
    return stats;
  }

  // ========== PRIVATE HELPER METHODS ==========

  private searchRecursive(
    dirPath: string,
    pattern: string,
    results: FileMatch[],
    maxResults: number,
    ignoreCase: boolean,
    filePattern?: string
  ): void {
    if (results.length >= maxResults) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.searchRecursive(fullPath, pattern, results, maxResults, ignoreCase, filePattern);
        } else {
          const name = ignoreCase ? entry.name.toLowerCase() : entry.name;
          
          // Check file pattern if specified
          if (filePattern && !this.matchesPattern(entry.name, filePattern)) {
            continue;
          }

          // Check if name matches search pattern
          if (name.includes(pattern)) {
            const stats = fs.statSync(fullPath);
            const relativePath = path.relative(
              this.workspaceDetector.getCurrentWorkspace()!,
              fullPath
            );

            results.push({
              path: relativePath,
              name: entry.name,
              size: stats.size,
              language: this.detectLanguage(entry.name)
            });
          }
        }
      }
    } catch (error) {
      // Ignore errors (permission denied, etc.)
    }
  }

  private searchContentRecursive(
    dirPath: string,
    searchRegex: RegExp,
    results: ContentMatch[],
    maxResults: number,
    contextLines: number,
    filePattern?: string
  ): void {
    if (results.length >= maxResults) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.searchContentRecursive(
            fullPath,
            searchRegex,
            results,
            maxResults,
            contextLines,
            filePattern
          );
        } else {
          // Check file pattern
          if (filePattern && !this.matchesPattern(entry.name, filePattern)) {
            continue;
          }

          // Only search text files
          if (!this.isTextFile(entry.name)) {
            continue;
          }

          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            const relativePath = path.relative(
              this.workspaceDetector.getCurrentWorkspace()!,
              fullPath
            );

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;

              const line = lines[i];
              const match = line.match(searchRegex);

              if (match) {
                results.push({
                  path: relativePath,
                  line: i + 1,
                  content: line.trim(),
                  match: match[0],
                  context: {
                    before: this.getContext(lines, i, -contextLines),
                    after: this.getContext(lines, i, contextLines)
                  }
                });
              }
            }
          } catch (error) {
            // Ignore files that can't be read as text
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  private createSearchRegex(query: string, regex: boolean, caseSensitive: boolean): RegExp {
    if (regex) {
      return new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      // Escape special regex characters
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }
  }

  private getSymbolPatterns(symbol: string, type: string): string[] {
    const patterns: string[] = [];

    if (type === 'function' || type === 'all') {
      // Function declarations
      patterns.push(`function\\s+${symbol}\\s*\\(`);
      patterns.push(`const\\s+${symbol}\\s*=\\s*\\(`);
      patterns.push(`${symbol}\\s*:\\s*\\([^)]*\\)\\s*=>`);
      patterns.push(`async\\s+function\\s+${symbol}\\s*\\(`);
    }

    if (type === 'class' || type === 'all') {
      // Class declarations
      patterns.push(`class\\s+${symbol}\\s*[{<]`);
      patterns.push(`interface\\s+${symbol}\\s*[{<]`);
      patterns.push(`type\\s+${symbol}\\s*=`);
    }

    if (type === 'variable' || type === 'all') {
      // Variable declarations
      patterns.push(`const\\s+${symbol}\\s*[=:]`);
      patterns.push(`let\\s+${symbol}\\s*[=:]`);
      patterns.push(`var\\s+${symbol}\\s*[=:]`);
    }

    return patterns;
  }

  private getContext(lines: string[], index: number, offset: number): string[] {
    const context: string[] = [];
    const start = Math.max(0, index + (offset < 0 ? offset : 1));
    const end = Math.min(lines.length, index + (offset < 0 ? 0 : offset + 1));

    for (let i = start; i < end; i++) {
      if (i !== index) {
        context.push(lines[i].trim());
      }
    }

    return context;
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(filename);
    }
    return filename.includes(pattern);
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
      '.css', '.scss', '.html', '.xml', '.yaml', '.yml',
      '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h',
      '.rb', '.php', '.swift', '.kt', '.sql', '.sh'
    ];

    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext);
  }

  private detectLanguage(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.rs': 'Rust',
      '.go': 'Go',
      '.java': 'Java',
      '.json': 'JSON',
      '.md': 'Markdown'
    };

    return langMap[ext] || 'Unknown';
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.turbo',
      'coverage',
      '.cache'
    ];

    return ignorePatterns.some(pattern => name === pattern || name.startsWith('.'));
  }

  private countExtensions(dirPath: string, extensions: Map<string, number>): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.countExtensions(fullPath, extensions);
        } else {
          const ext = path.extname(entry.name);
          if (ext) {
            extensions.set(ext, (extensions.get(ext) || 0) + 1);
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  private calculateStats(
    dirPath: string,
    stats: {
      totalFiles: number;
      totalSize: number;
      byExtension: Map<string, { count: number; size: number }>;
    }
  ): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.calculateStats(fullPath, stats);
        } else {
          try {
            const fileStats = fs.statSync(fullPath);
            const ext = path.extname(entry.name) || 'no-extension';

            stats.totalFiles++;
            stats.totalSize += fileStats.size;

            const extStats = stats.byExtension.get(ext) || { count: 0, size: 0 };
            extStats.count++;
            extStats.size += fileStats.size;
            stats.byExtension.set(ext, extStats);
          } catch (error) {
            // Ignore stat errors
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
}