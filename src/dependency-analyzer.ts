import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

// Types for dependency analysis
export interface ImportInfo {
  source: string;           // The module being imported (e.g., './utils' or 'react')
  importedNames: string[];  // Named imports (e.g., ['useState', 'useEffect'])
  defaultImport?: string;   // Default import name
  namespaceImport?: string; // Namespace import (e.g., 'import * as React')
  isExternal: boolean;      // Whether it's an npm package vs local file
  line: number;             // Line number in file
  rawStatement: string;     // Original import statement
}

export interface ExportInfo {
  exportedNames: string[];  // Named exports
  hasDefaultExport: boolean;
  line: number;
  rawStatement: string;
}

export interface DependencyGraph {
  filePath: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  importers: string[];      // Files that import this file
  dependencies: string[];   // Files this file imports
  circularDeps: CircularDependency[];
}

export interface CircularDependency {
  cycle: string[];          // Array of file paths forming the cycle
  description: string;
}

export interface DependencyTree {
  file: string;
  depth: number;
  imports: DependencyTree[];
  isExternal: boolean;
  isCyclic?: boolean;
}

export class DependencyAnalyzer {
  private workspacePath: string;
  private fileCache: Map<string, string>;
  private dependencyCache: Map<string, DependencyGraph>;
  private fileWatcher: chokidar.FSWatcher | null = null;
  
  // File size limits to prevent OOM crashes
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB - prevents OOM crashes
  private readonly WARN_FILE_SIZE = 1 * 1024 * 1024; // 1MB - warn but still process
  
  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.fileCache = new Map();
    this.dependencyCache = new Map();
    this.setupFileWatcher();
  }

  /**
   * Set up file watcher for cache invalidation
   */
  private setupFileWatcher(): void {
    const watchPatterns = [
      path.join(this.workspacePath, '**/*.{ts,tsx,js,jsx,mjs,cjs}'),
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
        this.invalidateCache(filePath);
      })
      .on('add', (filePath) => {
        this.invalidateCache(filePath);
      })
      .on('unlink', (filePath) => {
        this.invalidateCache(filePath);
      })
      .on('error', (error) => {
        console.error('Dependency analyzer file watcher error:', error);
      });
  }

  /**
   * Invalidate caches for a specific file
   */
  private invalidateCache(filePath: string): void {
    // Remove file from cache
    this.fileCache.delete(filePath);
    
    // Remove dependency graph from cache
    this.dependencyCache.delete(filePath);
    
    // Also invalidate any dependent files (files that import this file)
    for (const [cachedFile, graph] of this.dependencyCache.entries()) {
      if (graph.dependencies.includes(filePath) || graph.importers.includes(filePath)) {
        this.dependencyCache.delete(cachedFile);
      }
    }
    
    console.error(`🔄 Dependency cache invalidated: ${path.relative(this.workspacePath, filePath)}`);
  }

  /**
   * Main method: Analyze all dependencies for a file
   */
  public analyzeDependencies(filePath: string): DependencyGraph {
    const absolutePath = this.resolveFilePath(filePath);
    
    // Check cache first
    if (this.dependencyCache.has(absolutePath)) {
      return this.dependencyCache.get(absolutePath)!;
    }

    const imports = this.getImports(absolutePath);
    const exports = this.getExports(absolutePath);
    const importers = this.findImporters(absolutePath);
    const dependencies = imports.map(imp => this.resolveImportPath(absolutePath, imp.source)).filter(Boolean) as string[];
    const circularDeps = this.detectCircularDependencies(absolutePath);

    const graph: DependencyGraph = {
      filePath: absolutePath,
      imports,
      exports,
      importers,
      dependencies,
      circularDeps
    };

    this.dependencyCache.set(absolutePath, graph);
    return graph;
  }

  /**
   * Get all imports from a file
   */
  public getImports(filePath: string): ImportInfo[] {
    const content = this.readFile(filePath);
    const imports: ImportInfo[] = [];
    
    // Regex patterns for different import styles
    const patterns = [
      // ES6 imports: import { x, y } from 'module'
      /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
      // Default import: import React from 'react'
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      // Namespace import: import * as name from 'module'
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      // Side-effect import: import 'module'
      /import\s+['"]([^'"]+)['"]/g,
      // require(): const x = require('module')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    const lines = content.split('\n');
    
    lines.forEach((line, lineNumber) => {
      // ES6 named imports
      const namedMatch = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (namedMatch) {
        const importedNames = namedMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
        const source = namedMatch[2];
        imports.push({
          source,
          importedNames,
          isExternal: this.isExternalModule(source),
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
        return;
      }

      // Default import
      const defaultMatch = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (defaultMatch && !line.includes('*')) {
        imports.push({
          source: defaultMatch[2],
          importedNames: [],
          defaultImport: defaultMatch[1],
          isExternal: this.isExternalModule(defaultMatch[2]),
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
        return;
      }

      // Namespace import
      const namespaceMatch = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (namespaceMatch) {
        imports.push({
          source: namespaceMatch[2],
          importedNames: [],
          namespaceImport: namespaceMatch[1],
          isExternal: this.isExternalModule(namespaceMatch[2]),
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
        return;
      }

      // Side-effect import
      const sideEffectMatch = /^import\s+['"]([^'"]+)['"]/.exec(line.trim());
      if (sideEffectMatch) {
        imports.push({
          source: sideEffectMatch[1],
          importedNames: [],
          isExternal: this.isExternalModule(sideEffectMatch[1]),
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
        return;
      }

      // require()
      const requireMatch = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(line);
      if (requireMatch) {
        imports.push({
          source: requireMatch[1],
          importedNames: [],
          isExternal: this.isExternalModule(requireMatch[1]),
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
      }
    });

    return imports;
  }

  /**
   * Get all exports from a file
   */
  public getExports(filePath: string): ExportInfo[] {
    const content = this.readFile(filePath);
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineNumber) => {
      // Named exports: export { x, y }
      const namedMatch = /export\s+{([^}]+)}/.exec(line);
      if (namedMatch) {
        const exportedNames = namedMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
        exports.push({
          exportedNames,
          hasDefaultExport: false,
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
        return;
      }

      // Export declaration: export const x = ...
      const declMatch = /export\s+(const|let|var|function|class|interface|type|enum)\s+(\w+)/.exec(line);
      if (declMatch) {
        exports.push({
          exportedNames: [declMatch[2]],
          hasDefaultExport: false,
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
        return;
      }

      // Default export
      if (line.includes('export default')) {
        exports.push({
          exportedNames: [],
          hasDefaultExport: true,
          line: lineNumber + 1,
          rawStatement: line.trim()
        });
      }
    });

    return exports;
  }

  /**
   * Find all files that import the given file
   */
  public findImporters(filePath: string, maxFiles: number = 1000): string[] {
    const absolutePath = this.resolveFilePath(filePath);
    const importers: string[] = [];
    const allFiles = this.getAllProjectFiles(maxFiles);

    for (const file of allFiles) {
      if (file === absolutePath) continue;
      
      const imports = this.getImports(file);
      for (const imp of imports) {
        const resolvedImport = this.resolveImportPath(file, imp.source);
        if (resolvedImport === absolutePath) {
          importers.push(file);
          break;
        }
      }
    }

    return importers;
  }

  /**
   * Detect circular dependencies
   */
  public detectCircularDependencies(filePath: string): CircularDependency[] {
    const absolutePath = this.resolveFilePath(filePath);
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: CircularDependency[] = [];

    const dfs = (currentFile: string, path: string[]) => {
      if (recursionStack.has(currentFile)) {
        // Found a cycle
        const cycleStart = path.indexOf(currentFile);
        const cycle = path.slice(cycleStart).concat([currentFile]);
        cycles.push({
          cycle,
          description: `Circular dependency: ${cycle.join(' → ')}`
        });
        return;
      }

      if (visited.has(currentFile)) {
        return;
      }

      visited.add(currentFile);
      recursionStack.add(currentFile);

      const imports = this.getImports(currentFile);
      for (const imp of imports) {
        if (!imp.isExternal) {
          const resolvedPath = this.resolveImportPath(currentFile, imp.source);
          if (resolvedPath) {
            dfs(resolvedPath, [...path, currentFile]);
          }
        }
      }

      recursionStack.delete(currentFile);
    };

    dfs(absolutePath, []);
    return cycles;
  }

  /**
   * Get dependency tree with depth
   */
  public getDependencyTree(filePath: string, maxDepth: number = 3): DependencyTree {
    const absolutePath = this.resolveFilePath(filePath);
    const visited = new Set<string>();

    const buildTree = (file: string, depth: number): DependencyTree => {
      const imports = this.getImports(file);
      const tree: DependencyTree = {
        file: this.getRelativePath(file),
        depth,
        imports: [],
        isExternal: false,
        isCyclic: visited.has(file)
      };

      if (depth >= maxDepth || visited.has(file)) {
        return tree;
      }

      visited.add(file);

      for (const imp of imports) {
        if (imp.isExternal) {
          tree.imports.push({
            file: imp.source,
            depth: depth + 1,
            imports: [],
            isExternal: true
          });
        } else {
          const resolvedPath = this.resolveImportPath(file, imp.source);
          if (resolvedPath) {
            tree.imports.push(buildTree(resolvedPath, depth + 1));
          }
        }
      }

      return tree;
    };

    return buildTree(absolutePath, 0);
  }

  // Helper methods

  private readFile(filePath: string): string {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }
    
    try {
      // Check file size first to prevent OOM crashes
      const stats = fs.statSync(filePath);
      
      if (stats.size > this.MAX_FILE_SIZE) {
        console.error(`⚠️  File too large for dependency analysis (${(stats.size / 1024 / 1024).toFixed(1)}MB), skipping: ${path.relative(this.workspacePath, filePath)}`);
        return '';
      }
      
      if (stats.size > this.WARN_FILE_SIZE) {
        console.error(`⚠️  Large file in dependency analysis (${(stats.size / 1024 / 1024).toFixed(1)}MB): ${path.relative(this.workspacePath, filePath)}`);
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      this.fileCache.set(filePath, content);
      return content;
    } catch (error) {
      return '';
    }
  }

  private resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.workspacePath, filePath);
  }

  private getRelativePath(filePath: string): string {
    return path.relative(this.workspacePath, filePath);
  }

  private isExternalModule(source: string): boolean {
    // External if it doesn't start with . or /
    return !source.startsWith('.') && !source.startsWith('/');
  }

  private resolveImportPath(fromFile: string, importSource: string): string | null {
    if (this.isExternalModule(importSource)) {
      return null; // Don't resolve external modules
    }

    const dir = path.dirname(fromFile);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    
    // Try to resolve with extensions
    for (const ext of extensions) {
      const withExt = path.resolve(dir, importSource + ext);
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexFile = path.resolve(dir, importSource, 'index' + ext);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }

    // Try as-is
    const asIs = path.resolve(dir, importSource);
    if (fs.existsSync(asIs)) {
      return asIs;
    }

    return null;
  }

  private getAllProjectFiles(maxFiles: number = 1000): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    let fileCount = 0;
    
    const walk = (dir: string) => {
      // Stop if we've hit the file limit
      if (fileCount >= maxFiles) {
        return;
      }
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          // Check limit again in the loop
          if (fileCount >= maxFiles) {
            console.warn(`⚠️  File limit reached (${maxFiles} files). Stopping scan to prevent hangs.`);
            return;
          }
          
          const fullPath = path.join(dir, entry.name);
          
          // Skip node_modules, dist, build, etc.
          if (entry.isDirectory()) {
            if (!['node_modules', 'dist', 'build', '.git', '.next', 'out', 'coverage'].includes(entry.name)) {
              walk(fullPath);
            }
          } else {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
              fileCount++;
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(this.workspacePath);
    
    if (fileCount >= maxFiles) {
      console.warn(`📊 Scanned ${maxFiles} files (limit reached). Use smaller projects or increase limit for complete analysis.`);
    }
    
    return files;
  }

  /**
   * Clear caches (useful for testing or when files change)
   */
  public clearCache() {
    this.fileCache.clear();
    this.dependencyCache.clear();
  }

  /**
   * Dispose resources (cleanup file watcher)
   */
  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      console.error('📁 Dependency analyzer file watcher disposed');
    }
  }
}
