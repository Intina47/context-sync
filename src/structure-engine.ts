/**
 * Structure Engine
 * 
 * Layer 1: Fast directory tree generation
 * Layer 2: Complexity analysis per directory
 * Layer 3: Architecture insights and hotspots
 * 
 * Features:
 * - Directory complexity scoring
 * - Architecture pattern detection
 * - Hotspot identification (most complex areas)
 * - Size and LOC per directory
 * - Test coverage indicators
 * - Configuration detection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ReadFileEngine } from './read-file-engine.js';

interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: DirectoryNode[];
  metadata?: {
    fileCount?: number;
    totalSize?: number;
    totalLOC?: number;
    avgComplexity?: string;
    complexityScore?: number;
    languages?: string[];
    hasTests?: boolean;
    hasConfig?: boolean;
  };
}

interface StructureResult {
  tree: string;
  summary: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    totalLOC: number;
    languages: { [key: string]: number };
    architecturePattern?: string;
    hotspots: Array<{
      path: string;
      reason: string;
      complexity: number;
      loc: number;
    }>;
  };
  insights: string[];
}

export class StructureEngine {
  private workspacePath: string;
  private readFileEngine: ReadFileEngine;
  private analysisCache: Map<string, DirectoryNode>;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.readFileEngine = new ReadFileEngine(workspacePath);
    this.analysisCache = new Map();
  }

  /**
   * Layer 1 + 2 + 3: Get enriched project structure
   */
  async getStructure(
    depth: number = 3,
    options: {
      includeMetadata?: boolean;
      analyzeComplexity?: boolean;
      detectHotspots?: boolean;
    } = {}
  ): Promise<StructureResult> {
    const {
      includeMetadata = true,
      analyzeComplexity = true,
      detectHotspots = true
    } = options;

    // Layer 1: Build directory tree
    const rootNode = await this.buildTree(this.workspacePath, depth);

    // Layer 2: Analyze directories if requested
    if (includeMetadata && analyzeComplexity) {
      await this.analyzeDirectories(rootNode);
    }

    // Generate tree string
    const tree = this.renderTree(rootNode, 0, depth);

    // Layer 3: Generate insights and detect hotspots
    const summary = await this.generateSummary(rootNode);
    const insights = this.generateInsights(rootNode, summary);

    if (detectHotspots) {
      summary.hotspots = await this.detectHotspots(rootNode);
    }

    return {
      tree,
      summary,
      insights
    };
  }

  /**
   * Layer 1: Build directory tree efficiently
   */
  private async buildTree(
    dirPath: string,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<DirectoryNode> {
    const name = path.basename(dirPath);
    const relativePath = path.relative(this.workspacePath, dirPath);

    const node: DirectoryNode = {
      name: name || 'root',
      path: relativePath || '.',
      type: 'directory',
      children: []
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip common ignore patterns
        if (this.shouldIgnore(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(this.workspacePath, fullPath);

        if (entry.isDirectory()) {
          const childNode = await this.buildTree(fullPath, maxDepth, currentDepth + 1);
          node.children!.push(childNode);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          node.children!.push({
            name: entry.name,
            path: relPath,
            type: 'file',
            size: stats.size
          });
        }
      }

      // Sort: directories first, then files, alphabetically
      node.children!.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      // Skip inaccessible directories
    }

    return node;
  }

  /**
   * Layer 2: Analyze directories with complexity scoring
   */
  private async analyzeDirectories(node: DirectoryNode): Promise<void> {
    if (node.type === 'directory' && node.children) {
      let totalSize = 0;
      let totalLOC = 0;
      let fileCount = 0;
      let complexitySum = 0;
      let complexityCount = 0;
      const languages = new Set<string>();
      let hasTests = false;
      let hasConfig = false;

      for (const child of node.children) {
        if (child.type === 'file') {
          fileCount++;
          totalSize += child.size || 0;

          // Check for tests and configs
          if (child.name.includes('test') || child.name.includes('spec')) {
            hasTests = true;
          }
          if (child.name.includes('config') || child.name === 'package.json' || child.name === 'tsconfig.json') {
            hasConfig = true;
          }

          // Analyze code files for complexity (limit to avoid slowdown)
          if (fileCount <= 20 && this.isCodeFile(child.name)) {
            try {
              const fullPath = path.join(this.workspacePath, child.path);
              const fileCtx = await this.readFileEngine.read(fullPath);
              
              totalLOC += fileCtx.metadata.linesOfCode;
              languages.add(fileCtx.metadata.language);

              // Convert complexity level to score
              const complexityScore = this.complexityToScore(fileCtx.complexity.level);
              complexitySum += complexityScore;
              complexityCount++;
            } catch (err) {
              // Skip files that can't be analyzed
            }
          }
        } else if (child.type === 'directory') {
          // Recursively analyze child directories
          await this.analyzeDirectories(child);

          // Aggregate child metadata
          if (child.metadata) {
            totalSize += child.metadata.totalSize || 0;
            totalLOC += child.metadata.totalLOC || 0;
            fileCount += child.metadata.fileCount || 0;
            if (child.metadata.hasTests) hasTests = true;
            if (child.metadata.hasConfig) hasConfig = true;
            if (child.metadata.languages) {
              child.metadata.languages.forEach(l => languages.add(l));
            }
            if (child.metadata.complexityScore) {
              complexitySum += child.metadata.complexityScore;
              complexityCount++;
            }
          }
        }
      }

      // Calculate average complexity
      const avgComplexityScore = complexityCount > 0 ? complexitySum / complexityCount : 0;
      const avgComplexity = this.scoreToComplexity(avgComplexityScore);

      node.metadata = {
        fileCount,
        totalSize,
        totalLOC,
        avgComplexity,
        complexityScore: avgComplexityScore,
        languages: Array.from(languages),
        hasTests,
        hasConfig
      };
    }
  }

  /**
   * Layer 1: Render tree as string
   */
  private renderTree(
    node: DirectoryNode,
    depth: number,
    maxDepth: number,
    prefix: string = '',
    isLast: boolean = true
  ): string {
    let result = '';

    if (depth === 0) {
      result += `${node.name}/\n`;
    } else {
      const connector = isLast ? ' ' : ' ';
      const icon = node.type === 'directory' ? ' ' : ' ';
      
      let line = `${prefix}${connector}${icon}${node.name}`;
      
      // Add metadata for directories
      if (node.type === 'directory' && node.metadata) {
        const meta = node.metadata;
        if (meta.fileCount) {
          line += ` (${meta.fileCount} files`;
          if (meta.totalLOC && meta.totalLOC > 0) {
            line += `, ${meta.totalLOC.toLocaleString()} LOC`;
          }
          if (meta.avgComplexity) {
            const emoji = meta.avgComplexity === 'low' ? '' : 
                         meta.avgComplexity === 'medium' ? '' : 
                         meta.avgComplexity === 'high' ? '' : '';
            line += `, ${emoji} ${meta.avgComplexity}`;
          }
          line += ')';
        }
      }
      // Add size for files
      else if (node.type === 'file' && node.size) {
        line += ` (${this.formatBytes(node.size)})`;
      }
      
      result += line + '\n';
    }

    if (depth < maxDepth && node.children) {
      const newPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '   ');
      
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childIsLast = i === node.children.length - 1;
        result += this.renderTree(child, depth + 1, maxDepth, newPrefix, childIsLast);
      }
    }

    return result;
  }

  /**
   * Layer 3: Generate summary statistics
   */
  private async generateSummary(node: DirectoryNode): Promise<StructureResult['summary']> {
    const summary: StructureResult['summary'] = {
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      totalLOC: 0,
      languages: {} as { [key: string]: number },
      architecturePattern: undefined,
      hotspots: []
    };

    this.collectStats(node, summary);

    // Detect architecture pattern
    summary.architecturePattern = this.detectArchitecture(node);

    return summary;
  }

  /**
   * Collect statistics recursively
   */
  private collectStats(node: DirectoryNode, summary: StructureResult['summary']): void {
    if (node.type === 'directory') {
      summary.totalDirectories++;
      
      if (node.metadata) {
        summary.totalSize += node.metadata.totalSize || 0;
        summary.totalLOC += node.metadata.totalLOC || 0;
        
        if (node.metadata.languages) {
          node.metadata.languages.forEach(lang => {
            summary.languages[lang] = (summary.languages[lang] || 0) + 1;
          });
        }
      }

      if (node.children) {
        node.children.forEach(child => this.collectStats(child, summary));
      }
    } else {
      summary.totalFiles++;
      summary.totalSize += node.size || 0;
    }
  }

  /**
   * Layer 3: Detect architecture pattern
   */
  private detectArchitecture(node: DirectoryNode): string {
    const dirNames = new Set<string>();
    
    const collectDirNames = (n: DirectoryNode) => {
      if (n.type === 'directory') {
        dirNames.add(n.name.toLowerCase());
        if (n.children) {
          n.children.forEach(child => collectDirNames(child));
        }
      }
    };
    
    collectDirNames(node);

    // Detect patterns
    if (dirNames.has('src') && dirNames.has('components') && dirNames.has('pages')) {
      return 'Next.js / React Framework';
    }
    if (dirNames.has('src') && dirNames.has('routes') && dirNames.has('views')) {
      return 'MVC / Web Framework';
    }
    if (dirNames.has('src') && dirNames.has('lib') && dirNames.has('bin')) {
      return 'Library / CLI Tool';
    }
    if (dirNames.has('src') && dirNames.has('test')) {
      return 'Standard Project Structure';
    }
    if (dirNames.has('server') && dirNames.has('client')) {
      return 'Full-Stack Application';
    }
    
    return 'Custom Structure';
  }

  /**
   * Layer 3: Detect hotspots (most complex areas)
   */
  private async detectHotspots(node: DirectoryNode): Promise<StructureResult['summary']['hotspots']> {
    const hotspots: StructureResult['summary']['hotspots'] = [];

    const traverse = (n: DirectoryNode) => {
      if (n.type === 'directory' && n.metadata) {
        const score = n.metadata.complexityScore || 0;
        const loc = n.metadata.totalLOC || 0;

        // Hotspot criteria: high complexity OR large LOC
        if ((score >= 40 && loc > 100) || loc > 5000) {
          let reason = '';
          if (score >= 60) {
            reason = 'Very high complexity';
          } else if (score >= 40) {
            reason = 'High complexity';
          } else if (loc > 5000) {
            reason = 'Large codebase';
          }

          hotspots.push({
            path: n.path,
            reason,
            complexity: Math.round(score),
            loc
          });
        }

        if (n.children) {
          n.children.forEach(child => traverse(child));
        }
      }
    };

    traverse(node);

    // Sort by complexity + LOC
    hotspots.sort((a, b) => (b.complexity + b.loc / 100) - (a.complexity + a.loc / 100));

    return hotspots.slice(0, 5); // Top 5 hotspots
  }

  /**
   * Layer 3: Generate insights
   */
  private generateInsights(node: DirectoryNode, summary: StructureResult['summary']): string[] {
    const insights: string[] = [];

    // Language insights
    const languages = Object.keys(summary.languages);
    if (languages.length > 0) {
      const primary = languages[0];
      insights.push(`Primary language: ${primary}`);
    }

    // Size insights
    if (summary.totalLOC > 10000) {
      insights.push('Large codebase - consider modularization');
    } else if (summary.totalLOC < 1000) {
      insights.push('Small codebase - good for quick understanding');
    }

    // Test insights
    const hasTests = this.hasTestDirectory(node);
    if (!hasTests) {
      insights.push('  No test directory detected - consider adding tests');
    }

    // Architecture insights
    if (summary.architecturePattern) {
      insights.push(`Architecture: ${summary.architecturePattern}`);
    }

    return insights;
  }

  /**
   * Helper: Check if directory tree has tests
   */
  private hasTestDirectory(node: DirectoryNode): boolean {
    if (node.type === 'directory') {
      const name = node.name.toLowerCase();
      if (name === 'test' || name === 'tests' || name === '__tests__') {
        return true;
      }
      if (node.children) {
        return node.children.some(child => this.hasTestDirectory(child));
      }
    }
    return false;
  }

  /**
   * Helper: Check if should ignore
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
   * Helper: Check if code file
   */
  private isCodeFile(name: string): boolean {
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h'];
    return extensions.some(ext => name.endsWith(ext));
  }

  /**
   * Helper: Convert complexity level to score
   */
  private complexityToScore(level: string): number {
    switch (level) {
      case 'low': return 10;
      case 'medium': return 30;
      case 'high': return 50;
      case 'very-high': return 70;
      default: return 0;
    }
  }

  /**
   * Helper: Convert score to complexity level
   */
  private scoreToComplexity(score: number): string {
    if (score < 20) return 'low';
    if (score < 40) return 'medium';
    if (score < 60) return 'high';
    return 'very-high';
  }

  /**
   * Helper: Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}


