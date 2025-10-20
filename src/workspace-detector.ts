// IDE Workspace Detection and File Reading

import * as fs from 'fs';
import * as path from 'path';
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

  constructor(
    private storage: Storage,
    private projectDetector: ProjectDetector
  ) {}

  /**
   * Set the current workspace (called when IDE opens a folder)
   */
  setWorkspace(workspacePath: string): void {
    this.currentWorkspace = workspacePath;
    this.fileCache.clear();
    
    // Auto-detect and initialize project
    this.projectDetector.createOrUpdateProject(workspacePath);
    
    console.error(`📂 Workspace set: ${workspacePath}`);
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
  readFile(relativePath: string): FileContent | null {
    if (!this.currentWorkspace) {
      return null;
    }

    const fullPath = path.join(this.currentWorkspace, relativePath);
    
    // Check cache first
    if (this.fileCache.has(fullPath)) {
      return this.fileCache.get(fullPath)!;
    }

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
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
  getProjectStructure(maxDepth: number = 3): string {
    if (!this.currentWorkspace) {
      return 'No workspace open';
    }

    const structure: string[] = [];
    this.buildStructure(this.currentWorkspace, '', 0, maxDepth, structure);
    return structure.join('\n');
  }

  private buildStructure(
    dirPath: string,
    prefix: string,
    depth: number,
    maxDepth: number,
    output: string[]
  ): void {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      // Filter out common ignore patterns
      const filtered = entries.filter(entry => {
        const name = entry.name;
        return !this.shouldIgnore(name);
      });

      filtered.forEach((entry, index) => {
        const isLast = index === filtered.length - 1;
        const marker = isLast ? '└── ' : '├── ';
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          output.push(`${prefix}${marker}📁 ${entry.name}/`);
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          this.buildStructure(fullPath, newPrefix, depth + 1, maxDepth, output);
        } else {
          const icon = this.getFileIcon(entry.name);
          output.push(`${prefix}${marker}${icon} ${entry.name}`);
        }
      });
    } catch (error) {
      // Ignore errors (permission denied, etc.)
    }
  }

  /**
   * Scan important files (main entry points, configs, etc.)
   */
  scanImportantFiles(): FileContent[] {
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
      const file = this.readFile(pattern);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Create a snapshot of the project for context
   */
  createSnapshot(): ProjectSnapshot {
    const structure = this.getProjectStructure(3);
    const files = this.scanImportantFiles();
    
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
  searchFiles(pattern: string, maxResults: number = 20): FileContent[] {
    if (!this.currentWorkspace) {
      return [];
    }

    const results: FileContent[] = [];
    this.searchRecursive(this.currentWorkspace, pattern, results, maxResults);
    return results;
  }

  private searchRecursive(
    dirPath: string,
    pattern: string,
    results: FileContent[],
    maxResults: number
  ): void {
    if (results.length >= maxResults) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.searchRecursive(fullPath, pattern, results, maxResults);
        } else if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
          const relativePath = path.relative(this.currentWorkspace!, fullPath);
          const file = this.readFile(relativePath);
          if (file) {
            results.push(file);
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
}