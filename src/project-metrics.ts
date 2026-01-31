/**
 * Project Metrics Analyzer
 * Calculates LOC, file counts, complexity from scanned files
 */

import { promises as fs } from 'fs';
import { join, extname } from 'path';

export interface ProjectMetrics {
  linesOfCode: number;
  fileCount: number;
  complexity: number | null;
  lastUpdated: string;
}

export class MetricsAnalyzer {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async analyze(): Promise<ProjectMetrics> {
    const directories = [
      this.projectPath,       // Root
      join(this.projectPath, 'src'),
      join(this.projectPath, 'lib'),
      join(this.projectPath, 'app'),
      join(this.projectPath, 'pkg'),
      join(this.projectPath, 'cmd'),
    ];

    const files = new Set<string>();
    let linesOfCode = 0;

    for (const dir of directories) {
      try {
        const dirFiles = await this.scanDirectory(dir);
        dirFiles.forEach(f => files.add(f));
      } catch (err) {
        // Directory doesn't exist, continue
      }
    }

    // Count LOC for all unique files
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        linesOfCode += this.countLOC(content);
      } catch (err) {
        // File read error, skip
      }
    }

    return {
      linesOfCode,
      fileCount: files.size,
      complexity: null, // TODO: Implement cyclomatic complexity
      lastUpdated: new Date().toISOString()
    };
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const skipDirs = new Set([
      'node_modules', 'vendor', 'dist', 'build', 'out', '.next',
      'coverage', '.git', '.svn', 'target', 'bin', 'obj',
      '__pycache__', '.venv', 'venv', '.pytest_cache',
      'packaging', 'scripts', '.github', '.vscode', 'docs',
      'third_party', '.idea', '.gradle'
    ]);

    const extensions = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs',
      '.java', '.cpp', '.c', '.h', '.rb', '.php', '.cs'
    ]);

    const scan = async (currentDir: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentDir, entry.name);

          if (entry.isDirectory()) {
            if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = extname(entry.name);
            if (extensions.has(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (err) {
        // Permission error or directory doesn't exist
      }
    };

    await scan(dir);
    return files;
  }

  private countLOC(content: string): number {
    const lines = content.split('\n');
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed === '') continue;
      
      // Skip comments
      if (trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('/*')) continue;
      if (trimmed.startsWith('*')) continue;
      if (trimmed.startsWith('*/')) continue;
      
      count++;
    }

    return count;
  }
}

