/**
 * Search Engine
 * 
 * Layer 1: Fast search with relevance scoring
 * Layer 2: Semantic ranking based on context
 * Layer 3: File context enrichment (leverages read_file)
 * 
 * Features:
 * - Relevance scoring (exact match > prefix > fuzzy)
 * - Semantic ranking (imports, file type, recency)
 * - File complexity integration
 * - Search result clustering
 * - Smart suggestions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ReadFileEngine } from './read-file-engine.js';

interface SearchMatch {
  file: string;
  relativePath: string;
  line?: number;
  column?: number;
  text?: string;
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'content';
  relevanceScore: number;
  context?: {
    language?: string;
    complexity?: string;
    linesOfCode?: number;
    lastModified?: Date;
  };
}

interface SearchResult {
  query: string;
  totalMatches: number;
  matches: SearchMatch[];
  suggestions?: string[];
  clusters?: {
    [key: string]: SearchMatch[];
  };
}

export class SearchEngine {
  private workspacePath: string;
  private readFileEngine: ReadFileEngine;
  private fileCache: Map<string, { mtime: number; content: string }>;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.readFileEngine = new ReadFileEngine(workspacePath);
    this.fileCache = new Map();
  }

  /**
   * Layer 1: Fast file search with relevance scoring
   */
  async searchFiles(
    query: string,
    options: {
      maxResults?: number;
      enrichContext?: boolean;
      caseSensitive?: boolean;
    } = {}
  ): Promise<SearchResult> {
    const {
      maxResults = 50,
      enrichContext = true,
      caseSensitive = false
    } = options;

    // Find all files recursively
    const allFiles = await this.getAllFiles(this.workspacePath);

    // Score and rank matches
    const matches: SearchMatch[] = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (const file of allFiles) {
      const fileName = path.basename(file);
      const searchFileName = caseSensitive ? fileName : fileName.toLowerCase();
      const searchFilePath = caseSensitive ? file : file.toLowerCase();

      let matchType: SearchMatch['matchType'] | null = null;
      let score = 0;

      // Exact match (highest priority)
      if (searchFileName === searchQuery || searchFilePath === searchQuery) {
        matchType = 'exact';
        score = 100;
      }
      // Prefix match
      else if (searchFileName.startsWith(searchQuery) || searchFilePath.startsWith(searchQuery)) {
        matchType = 'prefix';
        score = 80;
      }
      // Contains match
      else if (searchFileName.includes(searchQuery) || searchFilePath.includes(searchQuery)) {
        matchType = 'fuzzy';
        score = 60;
      }
      // Fuzzy match (initials, e.g., "re" matches "recall-engine")
      else if (this.fuzzyMatch(searchFileName, searchQuery)) {
        matchType = 'fuzzy';
        score = 40;
      }

      if (matchType) {
        // Boost score based on file characteristics
        if (fileName.includes('index') || fileName.includes('main')) score += 5;
        if (fileName.endsWith('.ts') || fileName.endsWith('.js')) score += 3;
        if (file.split('/').length <= 2) score += 5; // Root level files

        const fullPath = path.join(this.workspacePath, file);
        matches.push({
          file: fullPath,
          relativePath: file,
          matchType,
          relevanceScore: score
        });
      }
    }

    // Sort by relevance
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Layer 3: Enrich top results with file context
    const topMatches = matches.slice(0, maxResults);
    if (enrichContext) {
      await this.enrichMatches(topMatches.slice(0, 10)); // Only enrich top 10 for performance
    }

    // Layer 2: Cluster results by directory
    const clusters = this.clusterByDirectory(topMatches);

    // Generate suggestions
    const suggestions = this.generateSuggestions(query, topMatches);

    return {
      query,
      totalMatches: matches.length,
      matches: topMatches,
      suggestions,
      clusters
    };
  }

  /**
   * Layer 1: Fast content search with context
   */
  async searchContent(
    query: string,
    options: {
      maxResults?: number;
      filePattern?: string;
      caseSensitive?: boolean;
      regex?: boolean;
      enrichContext?: boolean;
    } = {}
  ): Promise<SearchResult> {
    const {
      maxResults = 100,
      filePattern,
      caseSensitive = false,
      regex = false,
      enrichContext = false
    } = options;

    // Find files to search
    const allFiles = await this.getAllFiles(this.workspacePath);
    const files = filePattern 
      ? allFiles.filter(f => this.matchesPattern(f, filePattern))
      : allFiles.filter(f => this.isSearchableFile(f));

    const matches: SearchMatch[] = [];
    const searchPattern = regex ? new RegExp(query, caseSensitive ? 'g' : 'gi') : null;

    for (const file of files) {
      const fullPath = path.join(this.workspacePath, file);
      
      try {
        const content = await this.getCachedContent(fullPath);
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let found = false;
          let column = -1;

          if (regex && searchPattern) {
            const match = line.match(searchPattern);
            if (match) {
              found = true;
              column = match.index || 0;
            }
          } else {
            const searchLine = caseSensitive ? line : line.toLowerCase();
            const searchQuery = caseSensitive ? query : query.toLowerCase();
            column = searchLine.indexOf(searchQuery);
            found = column !== -1;
          }

          if (found) {
            // Calculate relevance score
            let score = 50;
            
            // Boost if query appears at start of line
            if (column < 5) score += 20;
            
            // Boost if line is shorter (more focused)
            if (line.length < 100) score += 10;
            
            // Boost for certain file types
            if (file.endsWith('.ts') || file.endsWith('.js')) score += 5;

            matches.push({
              file: fullPath,
              relativePath: file,
              line: i + 1,
              column,
              text: line,
              matchType: 'content',
              relevanceScore: score
            });

            if (matches.length >= maxResults * 2) break; // Early exit for performance
          }
        }
      } catch (err) {
        // Skip files that can't be read
        continue;
      }

      if (matches.length >= maxResults * 2) break;
    }

    // Sort by relevance
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const topMatches = matches.slice(0, maxResults);

    // Enrich if requested
    if (enrichContext) {
      await this.enrichMatches(topMatches.slice(0, 5));
    }

    // Cluster by file
    const clusters = this.clusterByFile(topMatches);

    return {
      query,
      totalMatches: matches.length,
      matches: topMatches,
      clusters
    };
  }

  /**
   * Layer 3: Enrich matches with file context
   */
  private async enrichMatches(matches: SearchMatch[]): Promise<void> {
    for (const match of matches) {
      try {
        const fileCtx = await this.readFileEngine.read(match.file);
        match.context = {
          language: fileCtx.metadata.language,
          complexity: fileCtx.complexity.level,
          linesOfCode: fileCtx.metadata.linesOfCode,
          lastModified: fileCtx.metadata.lastModified
        };
      } catch (err) {
        // Skip enrichment on error
        continue;
      }
    }
  }

  /**
   * Layer 2: Cluster results by directory
   */
  private clusterByDirectory(matches: SearchMatch[]): { [key: string]: SearchMatch[] } {
    const clusters: { [key: string]: SearchMatch[] } = {};

    for (const match of matches) {
      const dir = path.dirname(match.relativePath);
      if (!clusters[dir]) {
        clusters[dir] = [];
      }
      clusters[dir].push(match);
    }

    return clusters;
  }

  /**
   * Layer 2: Cluster results by file
   */
  private clusterByFile(matches: SearchMatch[]): { [key: string]: SearchMatch[] } {
    const clusters: { [key: string]: SearchMatch[] } = {};

    for (const match of matches) {
      const file = match.relativePath;
      if (!clusters[file]) {
        clusters[file] = [];
      }
      clusters[file].push(match);
    }

    return clusters;
  }

  /**
   * Layer 2: Generate search suggestions
   */
  private generateSuggestions(query: string, matches: SearchMatch[]): string[] {
    const suggestions: Set<string> = new Set();

    // Suggest similar filenames
    for (const match of matches.slice(0, 5)) {
      const basename = path.basename(match.relativePath, path.extname(match.relativePath));
      if (basename !== query && basename.includes(query)) {
        suggestions.add(basename);
      }
    }

    // Suggest common extensions
    const extensions = new Set(matches.map(m => path.extname(m.relativePath)));
    if (extensions.size > 1) {
      extensions.forEach(ext => {
        if (ext) suggestions.add(`${query}${ext}`);
      });
    }

    return Array.from(suggestions).slice(0, 5);
  }

  /**
   * Fuzzy match algorithm (initials matching)
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIdx = 0;
    let textIdx = 0;

    while (textIdx < text.length && patternIdx < pattern.length) {
      if (text[textIdx].toLowerCase() === pattern[patternIdx].toLowerCase()) {
        patternIdx++;
      }
      textIdx++;
    }

    return patternIdx === pattern.length;
  }

  /**
   * Get cached file content
   */
  private async getCachedContent(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    const mtime = stats.mtimeMs;

    const cached = this.fileCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.content;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    this.fileCache.set(filePath, { mtime, content });

    return content;
  }

  /**
   * Recursively get all files in directory
   */
  private async getAllFiles(dirPath: string, relativePath: string = ''): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip ignored patterns
        if (this.shouldIgnore(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath, relPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(relPath);
        }
      }
    } catch (err) {
      // Skip inaccessible directories
    }

    return files;
  }

  /**
   * Check if should ignore file/directory
   */
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.cache',
      '.DS_Store',
      'Thumbs.db'
    ];

    return ignorePatterns.includes(name) || name.startsWith('.');
  }

  /**
   * Check if file is searchable (code file)
   */
  private isSearchableFile(filePath: string): boolean {
    const extensions = [
      '.ts', '.js', '.tsx', '.jsx',
      '.py', '.go', '.rs', '.java',
      '.cpp', '.c', '.h',
      '.md', '.json', '.yaml', '.yml', '.toml'
    ];
    return extensions.some(ext => filePath.endsWith(ext)) 
      && !filePath.includes('package-lock.json')
      && !filePath.includes('yarn.lock')
      && !filePath.includes('pnpm-lock.yaml');
  }

  /**
   * Check if file matches pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(filePath);
    }
    return filePath.includes(pattern);
  }
}

