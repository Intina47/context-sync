/**
 * Read File Engine
 * Provides rich file context: content + metadata + relationships + complexity
 */

import { promises as fs } from 'fs';
import { join, extname, relative, dirname } from 'path';
import simpleGit from 'simple-git';

interface FileMetadata {
  size: number;
  lastModified: Date;
  author: string | null;
  changeFrequency: number; // commits in last 30 days
  linesOfCode: number;
  language: string;
}

interface FileRelationships {
  imports: string[]; // Files this imports
  importedBy: string[]; // Files that import this
  relatedTests: string[];
  relatedConfigs: string[];
}

interface FileComplexity {
  level: 'low' | 'medium' | 'high' | 'very-high';
  score: number;
  reasons: string[];
}

interface FileContext {
  path: string;
  content: string;
  metadata: FileMetadata;
  relationships: FileRelationships;
  complexity: FileComplexity;
}

export class ReadFileEngine {
  private projectPath: string;
  private git: ReturnType<typeof simpleGit>;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.git = simpleGit(projectPath);
  }

  /**
   * Read file with rich context
   */
  async read(relativePath: string): Promise<FileContext> {
    const fullPath = join(this.projectPath, relativePath);

    // Layer 1: Read file content and basic info
    const content = await fs.readFile(fullPath, 'utf-8');
    const stats = await fs.stat(fullPath);

    // Layer 2: Analyze in parallel
    const [metadata, relationships, complexity] = await Promise.all([
      this.analyzeMetadata(relativePath, stats, content),
      this.analyzeRelationships(relativePath, content),
      this.analyzeComplexity(content, relativePath)
    ]);

    return {
      path: relativePath,
      content,
      metadata,
      relationships,
      complexity
    };
  }

  /**
   * Analyze file metadata
   */
  private async analyzeMetadata(
    relativePath: string,
    stats: any,
    content: string
  ): Promise<FileMetadata> {
    // Git history
    let author: string | null = null;
    let changeFrequency = 0;

    try {
      // Get last author
      const log = await this.git.log({ file: relativePath, maxCount: 1 });
      author = log.latest?.author_name || null;

      // Count commits in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentLog = await this.git.log({
        file: relativePath,
        since: thirtyDaysAgo.toISOString()
      });
      changeFrequency = recentLog.all.length;
    } catch (err) {
      // Not a git repo or file not tracked
    }

    // Count lines of code (excluding blanks/comments)
    const linesOfCode = this.countLOC(content);

    // Detect language
    const language = this.detectLanguage(relativePath);

    return {
      size: stats.size,
      lastModified: stats.mtime,
      author,
      changeFrequency,
      linesOfCode,
      language
    };
  }

  /**
   * Analyze file relationships
   */
  private async analyzeRelationships(
    relativePath: string,
    content: string
  ): Promise<FileRelationships> {
    const imports: string[] = [];
    const importedBy: string[] = [];
    const relatedTests: string[] = [];
    const relatedConfigs: string[] = [];

    // Extract imports from file content
    const ext = extname(relativePath);
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      // JavaScript/TypeScript imports
      const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        let importPath = match[1];
        
        // Resolve relative imports
        if (importPath.startsWith('.')) {
          const dir = dirname(relativePath);
          importPath = join(dir, importPath);
          
          // Add common extensions if missing
          if (!extname(importPath)) {
            for (const tryExt of ['.ts', '.tsx', '.js', '.jsx']) {
              try {
                await fs.access(join(this.projectPath, importPath + tryExt));
                importPath += tryExt;
                break;
              } catch {}
            }
          }
          
          imports.push(importPath);
        }
      }
    } else if (['.py'].includes(ext)) {
      // Python imports
      const importRegex = /(?:from|import)\s+(\w+(?:\.\w+)*)/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } else if (['.go'].includes(ext)) {
      // Go imports
      const importRegex = /import\s+"([^"]+)"/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    // Find files that import this one (expensive, skip for now)
    // Could be optimized with a project-wide import graph

    // Find related test files
    const testPatterns = this.getTestFilePatterns(relativePath);
    for (const pattern of testPatterns) {
      try {
        await fs.access(join(this.projectPath, pattern));
        relatedTests.push(pattern);
      } catch {}
    }

    // Find related config files
    const configPatterns = this.getConfigFilePatterns(relativePath);
    for (const pattern of configPatterns) {
      try {
        await fs.access(join(this.projectPath, pattern));
        relatedConfigs.push(pattern);
      } catch {}
    }

    return {
      imports,
      importedBy, // TODO: Build project-wide graph
      relatedTests,
      relatedConfigs
    };
  }

  /**
   * Analyze file complexity
   */
  private analyzeComplexity(content: string, path: string): FileComplexity {
    let score = 0;
    const reasons: string[] = [];

    // Lines of code
    const loc = this.countLOC(content);
    if (loc > 500) {
      score += 30;
      reasons.push(`Large file (${loc} LOC)`);
    } else if (loc > 300) {
      score += 20;
      reasons.push(`Medium-large file (${loc} LOC)`);
    } else if (loc > 150) {
      score += 10;
    }

    // Cyclomatic complexity (count decision points)
    const decisionPoints = (content.match(/\b(if|else|for|while|switch|case|\?|&&|\|\|)\b/g) || []).length;
    if (decisionPoints > 50) {
      score += 30;
      reasons.push(`High cyclomatic complexity (${decisionPoints} decision points)`);
    } else if (decisionPoints > 25) {
      score += 15;
      reasons.push(`Medium complexity (${decisionPoints} decision points)`);
    }

    // Nesting depth (count indentation)
    const lines = content.split('\n');
    let maxIndent = 0;
    for (const line of lines) {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      maxIndent = Math.max(maxIndent, Math.floor(indent / 2));
    }
    if (maxIndent > 6) {
      score += 20;
      reasons.push(`Deep nesting (${maxIndent} levels)`);
    } else if (maxIndent > 4) {
      score += 10;
    }

    // Function count
    const functions = (content.match(/\bfunction\b|\bconst\s+\w+\s*=\s*\(|\bdef\b|\bfunc\b/g) || []).length;
    if (functions > 20) {
      score += 15;
      reasons.push(`Many functions (${functions})`);
    }

    // TODO statements
    const todos = (content.match(/\/\/\s*TODO|#\s*TODO/gi) || []).length;
    if (todos > 0) {
      score += todos * 5;
      reasons.push(`${todos} TODO(s) pending`);
    }

    // Determine level
    let level: FileComplexity['level'];
    if (score >= 60) {
      level = 'very-high';
    } else if (score >= 40) {
      level = 'high';
    } else if (score >= 20) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, score, reasons };
  }

  /**
   * Count lines of code (excluding blanks and comments)
   */
  private countLOC(content: string): number {
    const lines = content.split('\n');
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('/*')) continue;
      if (trimmed.startsWith('*')) continue;
      if (trimmed.startsWith('*/')) continue;
      count++;
    }

    return count;
  }

  /**
   * Detect programming language
   */
  private detectLanguage(path: string): string {
    const ext = extname(path);
    const map: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.go': 'Go',
      '.rs': 'Rust',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.cs': 'C#',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.md': 'Markdown',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.xml': 'XML',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sql': 'SQL'
    };
    return map[ext] || 'Unknown';
  }

  /**
   * Get potential test file patterns
   */
  private getTestFilePatterns(filePath: string): string[] {
    const dir = dirname(filePath);
    const base = filePath.replace(extname(filePath), '');
    const ext = extname(filePath);

    return [
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
      `${base}_test${ext}`,
      join(dir, '__tests__', filePath.split('/').pop() || ''),
      join('tests', filePath),
      join('test', filePath)
    ];
  }

  /**
   * Get potential config file patterns
   */
  private getConfigFilePatterns(filePath: string): string[] {
    if (filePath.includes('jest')) {
      return ['jest.config.js', 'jest.config.ts', 'package.json'];
    }
    if (filePath.includes('webpack')) {
      return ['webpack.config.js', 'webpack.config.ts'];
    }
    if (filePath.includes('vite')) {
      return ['vite.config.ts', 'vite.config.js'];
    }
    return ['package.json', 'tsconfig.json', '.eslintrc'];
  }
}

