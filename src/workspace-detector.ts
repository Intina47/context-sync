// IDE Workspace Detection and File Reading

import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { Storage } from './storage.js';
import { ProjectDetector } from './project-detector.js';

export interface FileContent {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface ProjectSnapshot {
  rootPath: string;
  files: FileContent[];
  structure: string;
  summary: string;
}

export class WorkspaceDetector {
  private currentWorkspace: string | null = null;
  private fileCache: Map<string, FileContent> = new Map();
  private fileWatcher: chokidar.FSWatcher | null = null;
  
  // File size limits to prevent OOM crashes
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB - prevents OOM crashes
  private readonly WARN_FILE_SIZE = 1 * 1024 * 1024; // 1MB - warn but still process

  constructor(
    private storage: Storage,
    private projectDetector: ProjectDetector
  ) {}

  /**
   * Set the current workspace (called when IDE opens a folder)
   */
  setWorkspace(workspacePath: string): void {
    // Dispose existing watcher
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    
    this.currentWorkspace = workspacePath;
    this.fileCache.clear();
    
    // Set up file watcher to invalidate cache on changes
    this.setupFileWatcher(workspacePath);
    
    // Auto-detect and initialize project (async, but don't block)
    this.projectDetector.createOrUpdateProject(workspacePath).catch(error => {
      console.error('Error auto-detecting project:', error);
    });
    
    console.error(`📂 Workspace set: ${workspacePath}`);
  }

  /**
   * Set up file watcher for cache invalidation
   */
  private setupFileWatcher(workspacePath: string): void {
    const watchPatterns = [
      path.join(workspacePath, '**/*.{ts,tsx,js,jsx,json,md}'),
    ];

    this.fileWatcher = chokidar.watch(watchPatterns, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/out/**',
        '**/coverage/**'
      ],
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.fileWatcher
      .on('change', (filePath) => {
        this.invalidateFileCache(filePath);
      })
      .on('add', (filePath) => {
        this.invalidateFileCache(filePath);
      })
      .on('unlink', (filePath) => {
        this.invalidateFileCache(filePath);
      })
      .on('error', (error) => {
        console.error('File watcher error:', error);
      });

    console.error('📁 File watcher active for cache invalidation');
  }

  /**
   * Invalidate cached file content
   */
  private invalidateFileCache(filePath: string): void {
    // Remove from file cache
    if (this.fileCache.has(filePath)) {
      this.fileCache.delete(filePath);
      console.error(`🔄 Cache invalidated: ${path.relative(this.currentWorkspace || '', filePath)}`);
    }

    // Also remove any related cached files (for relative path variations)
    const relativePath = this.currentWorkspace ? path.relative(this.currentWorkspace, filePath) : filePath;
    const fullPath = this.currentWorkspace ? path.join(this.currentWorkspace, relativePath) : filePath;
    
    this.fileCache.delete(relativePath);
    this.fileCache.delete(fullPath);
  }

  /**
   * Get current workspace
   */
  getCurrentWorkspace(): string | null {
    return this.currentWorkspace;
  }

  /**
   * Read a file from the workspace
   */
  async readFile(relativePath: string): Promise<FileContent | null> {
    if (!this.currentWorkspace) {
      return null;
    }

    const fullPath = path.join(this.currentWorkspace, relativePath);
    
    // Check cache first
    if (this.fileCache.has(fullPath)) {
      return this.fileCache.get(fullPath)!;
    }

    try {
      await fsAsync.access(fullPath);
    } catch {
      return null;
    }

    try {
      // Check file size first to prevent OOM crashes
      const stats = await fsAsync.stat(fullPath);
      
      if (stats.size > this.MAX_FILE_SIZE) {
        console.error(`⚠️  File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB), skipping: ${relativePath}`);
        return null;
      }
      
      if (stats.size > this.WARN_FILE_SIZE) {
        console.error(`⚠️  Large file detected (${(stats.size / 1024 / 1024).toFixed(1)}MB): ${relativePath}`);
      }
      
      const content = await fsAsync.readFile(fullPath, 'utf8');
      const language = this.detectLanguage(fullPath);
      const size = Buffer.byteLength(content);

      const fileContent: FileContent = {
        path: relativePath,
        content,
        language,
        size,
      };

      // Cache it
      this.fileCache.set(fullPath, fileContent);

      return fileContent;
    } catch (error) {
      console.error(`Error reading file ${fullPath}:`, error);
      return null;
    }
  }

  /**
   * Get project structure (file tree)
   */
  async getProjectStructure(maxDepth: number = 3): Promise<string> {
    if (!this.currentWorkspace) {
      return 'No workspace open';
    }

    const structure: string[] = [];
    await this.buildStructure(this.currentWorkspace, '', 0, maxDepth, structure);
    return structure.join('\n');
  }

  private async buildStructure(
    dirPath: string,
    prefix: string,
    depth: number,
    maxDepth: number,
    output: string[]
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fsAsync.readdir(dirPath, { withFileTypes: true });
      
      // Filter out common ignore patterns
      const filtered = entries.filter(entry => {
        const name = entry.name;
        return !this.shouldIgnore(name);
      });

      for (let index = 0; index < filtered.length; index++) {
        const entry = filtered[index];
        const isLast = index === filtered.length - 1;
        const marker = isLast ? '└── ' : '├── ';
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          output.push(`${prefix}${marker}📁 ${entry.name}/`);
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          await this.buildStructure(fullPath, newPrefix, depth + 1, maxDepth, output);
        } else {
          const icon = this.getFileIcon(entry.name);
          output.push(`${prefix}${marker}${icon} ${entry.name}`);
        }
      }
    } catch (error) {
      // Ignore errors (permission denied, etc.)
    }
  }

  /**
   * Scan important files (main entry points, configs, etc.)
   */
  async scanImportantFiles(): Promise<FileContent[]> {
    if (!this.currentWorkspace) {
      return [];
    }

    const importantPatterns = [
      // Entry points
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'src/app/page.tsx', 'src/app/layout.tsx',
      'pages/index.tsx', 'pages/_app.tsx',
      
      // Configs
      'package.json', 'tsconfig.json', 'next.config.js', 'vite.config.ts',
      'tailwind.config.js', 'prisma/schema.prisma',
      
      // Docs
      'README.md', 'CHANGELOG.md',
    ];

    const files: FileContent[] = [];

    for (const pattern of importantPatterns) {
      const file = await this.readFile(pattern);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Create a snapshot of the project for context
   */
  async createSnapshot(): Promise<ProjectSnapshot> {
    const structure = await this.getProjectStructure(3);
    const files = await this.scanImportantFiles();
    
    // Create summary
    const summary = this.generateSummary(files);

    return {
      rootPath: this.currentWorkspace || '',
      files,
      structure,
      summary,
    };
  }

  /**
   * Generate a summary of the project
   */
  private generateSummary(files: FileContent[]): string {
    const lines: string[] = [];

    // Count files by type
    const types = new Map<string, number>();
    files.forEach(f => {
      const count = types.get(f.language) || 0;
      types.set(f.language, count + 1);
    });

    lines.push('Project Summary:');
    types.forEach((count, lang) => {
      lines.push(`- ${count} ${lang} files scanned`);
    });

    // Total lines of code (approximate)
    const totalLines = files.reduce((sum, f) => {
      return sum + f.content.split('\n').length;
    }, 0);
    lines.push(`- ~${totalLines} lines of code`);

    return lines.join('\n');
  }

  /**
   * Check if file/folder should be ignored
   */
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.turbo',
      'coverage',
      '.cache',
      '.DS_Store',
      'yarn-error.log',
      'npm-debug.log',
      '.env.local',
      '.env',
    ];

    return ignorePatterns.some(pattern => name === pattern || name.startsWith('.'));
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.rs': 'Rust',
      '.go': 'Go',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.cs': 'C#',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.sql': 'SQL',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.html': 'HTML',
    };

    return langMap[ext] || 'Unknown';
  }

  /**
   * Get icon for file type
   */
  private getFileIcon(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    const iconMap: Record<string, string> = {
      '.ts': '📘',
      '.tsx': '⚛️',
      '.js': '📜',
      '.jsx': '⚛️',
      '.json': '📋',
      '.md': '📝',
      '.css': '🎨',
      '.html': '🌐',
      '.py': '🐍',
      '.rs': '🦀',
      '.go': '🔷',
    };

    return iconMap[ext] || '📄';
  }

  /**
   * Search for files matching a pattern
   */
  async searchFiles(pattern: string, maxResults: number = 20): Promise<FileContent[]> {
    if (!this.currentWorkspace) {
      return [];
    }

    const results: FileContent[] = [];
    await this.searchRecursive(this.currentWorkspace, pattern, results, maxResults);
    return results;
  }

  private async searchRecursive(
    dirPath: string,
    pattern: string,
    results: FileContent[],
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fsAsync.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.searchRecursive(fullPath, pattern, results, maxResults);
        } else if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
          const relativePath = path.relative(this.currentWorkspace!, fullPath);
          const file = await this.readFile(relativePath);
          if (file) {
            results.push(file);
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Dispose resources (cleanup file watcher)
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      console.error('📁 File watcher disposed');
    }
  }
}