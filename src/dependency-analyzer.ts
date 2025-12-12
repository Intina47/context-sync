import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { FileSizeGuard } from './file-size-guard.js';
import { skimForDependencies } from './file-skimmer.js';

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
  private fileSizeGuard: FileSizeGuard;
  // Performance: File index for O(1) importer lookups instead of O(n) scans
  private fileIndex: Map<string, Set<string>> | null = null;
  // Performance: Debounce file watcher to prevent thrashing
  private invalidateDebounceTimer: NodeJS.Timeout | null = null;
  private pendingInvalidations: Set<string> = new Set();
  private readonly DEBOUNCE_MS = 300;
  
  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.fileCache = new Map();
    this.dependencyCache = new Map();
    this.fileSizeGuard = new FileSizeGuard({
      maxFileSize: 5 * 1024 * 1024,    // 5MB per file (suitable for large TypeScript files)
      maxTotalSize: 50 * 1024 * 1024,   // 50MB total (prevent excessive memory use)
      skipLargeFiles: true,            // Skip rather than error on large files
    });
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
      .on('error', () => {
        // Silently handle file watcher errors
      });
  }

  /**
   * Invalidate caches for a specific file (debounced)
   */
  private invalidateCache(filePath: string): void {
    // Add to pending invalidations
    this.pendingInvalidations.add(filePath);
    
    // Clear existing timer
    if (this.invalidateDebounceTimer) {
      clearTimeout(this.invalidateDebounceTimer);
    }
    
    // Set new timer to batch invalidations
    this.invalidateDebounceTimer = setTimeout(() => {
      this.flushInvalidations();
    }, this.DEBOUNCE_MS);
  }
  
  /**
   * Flush all pending cache invalidations
   */
  private flushInvalidations(): void {
    if (this.pendingInvalidations.size === 0) {
      return;
    }
    
    const filesToInvalidate = Array.from(this.pendingInvalidations);
    this.pendingInvalidations.clear();
    this.invalidateDebounceTimer = null;
    
    console.error(`🔄 Flushing ${filesToInvalidate.length} cache invalidations...`);
    
    // Invalidate file index once (not per file)
    this.fileIndex = null;
    
    // Process each file
    for (const filePath of filesToInvalidate) {
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
    }
    
    const relPaths = filesToInvalidate.map(f => path.relative(this.workspacePath, f)).join(', ');
    console.error(`✅ Cache invalidated for: ${relPaths.length > 100 ? relPaths.slice(0, 97) + '...' : relPaths}`);
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
   * Build file index for fast importer lookups
   * Maps file path -> Set of files that import it
   */
  private buildFileIndex(maxFiles: number = 1000): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    const allFiles = this.getAllProjectFiles(maxFiles);
    
    console.error(`📊 Building file index for ${allFiles.length} files...`);
    
    for (const file of allFiles) {
      const imports = this.getImports(file);
      for (const imp of imports) {
        if (!imp.isExternal) {
          const resolvedPath = this.resolveImportPath(file, imp.source);
          if (resolvedPath) {
            if (!index.has(resolvedPath)) {
              index.set(resolvedPath, new Set());
            }
            index.get(resolvedPath)!.add(file);
          }
        }
      }
    }
    
    console.error(`✅ File index built with ${index.size} entries`);
    return index;
  }

  /**
   * Find all files that import the given file
   * Performance: O(1) with file index vs O(n) without
   */
  public findImporters(filePath: string, maxFiles: number = 1000): string[] {
    const absolutePath = this.resolveFilePath(filePath);
    
    // Build index on first use
    if (!this.fileIndex) {
      this.fileIndex = this.buildFileIndex(maxFiles);
    }
    
    // O(1) lookup!
    const importers = this.fileIndex.get(absolutePath);
    return importers ? Array.from(importers) : [];
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
      // Use intelligent skimming for dependency analysis
      const skimResult = skimForDependencies(filePath);
      
      if (!skimResult.content) {
        // Fallback to file size guard if skimming fails
        const guardResult = this.fileSizeGuard.readFile(filePath, 'utf-8');
        if (guardResult.skipped) {
          if (guardResult.reason) {
            console.error(`⚠️  ${guardResult.reason}, skipping: ${path.relative(this.workspacePath, filePath)}`);
          }
          return '';
        }
        const content = guardResult.content;
        this.fileCache.set(filePath, content);
        return content;
      }
      
      // Successfully skimmed or read the file
      // File skimming is now silent to reduce log noise
      
      const content = skimResult.content;
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
   * Dispose resources (cleanup file watcher and pending timers)
   */
  public dispose(): void {
    // Clear debounce timer and flush pending invalidations
    if (this.invalidateDebounceTimer) {
      clearTimeout(this.invalidateDebounceTimer);
      this.invalidateDebounceTimer = null;
    }
    this.flushInvalidations();
    
    // Close file watcher
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }
}
