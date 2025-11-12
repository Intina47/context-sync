import * as fs from 'fs';
import * as path from 'path';
import { FileSizeGuard } from './file-size-guard.js';
import { skimForFunctions } from './file-skimmer.js';

// Types for call graph analysis
export interface FunctionDefinition {
  name: string;
  filePath: string;
  line: number;
  type: 'function' | 'method' | 'arrow' | 'async';
  params: string[];
  isExported: boolean;
  className?: string;  // For methods
}

export interface FunctionCall {
  caller: string;           // Function that makes the call
  callee: string;           // Function being called
  line: number;
  filePath: string;
  isAsync: boolean;
  callExpression: string;   // The actual call code
}

export interface CallGraph {
  function: FunctionDefinition;
  callers: FunctionCall[];     // Functions that call this function
  callees: FunctionCall[];     // Functions this function calls
  callDepth: number;
  isRecursive: boolean;
}

export interface ExecutionPath {
  path: string[];              // Array of function names
  files: string[];             // Corresponding file paths
  description: string;
  isAsync: boolean;
  depth: number;
}

export interface CallTree {
  function: string;
  file: string;
  line: number;
  depth: number;
  calls: CallTree[];
  isRecursive?: boolean;
  isAsync?: boolean;
}

export class CallGraphAnalyzer {
  private workspacePath: string;
  private fileCache: Map<string, string>;
  private functionCache: Map<string, FunctionDefinition[]>;
  private callCache: Map<string, FunctionCall[]>;
  private fileSizeGuard: FileSizeGuard;
  
  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.fileCache = new Map();
    this.functionCache = new Map();
    this.callCache = new Map();
    this.fileSizeGuard = new FileSizeGuard({
      maxFileSize: 5 * 1024 * 1024,    // 5MB per file
      maxTotalSize: 50 * 1024 * 1024,   // 50MB total
      skipLargeFiles: true,
    });
  }

  /**
   * Main method: Analyze call graph for a function
   */
  public analyzeCallGraph(functionName: string): CallGraph | null {
    // Find the function definition
    const funcDef = this.findFunctionDefinition(functionName);
    
    if (!funcDef) {
      return null;
    }

    // Find all callers (who calls this function)
    const callers = this.findCallers(functionName);
    
    // Find all callees (what this function calls)
    const callees = this.findCallees(funcDef);
    
    // Check if recursive
    const isRecursive = callees.some(call => call.callee === functionName);
    
    return {
      function: funcDef,
      callers,
      callees,
      callDepth: this.calculateCallDepth(functionName),
      isRecursive
    };
  }

  /**
   * Find all functions that call the given function
   */
  public findCallers(functionName: string): FunctionCall[] {
    const callers: FunctionCall[] = [];
    const allFiles = this.getAllProjectFiles();

    for (const file of allFiles) {
      const content = this.readFile(file);
      const functions = this.extractFunctions(file);
      
      for (const func of functions) {
        const calls = this.extractFunctionCalls(file, func.name);
        
        for (const call of calls) {
          if (call.callee === functionName) {
            callers.push({
              caller: func.name,
              callee: functionName,
              line: call.line,
              filePath: file,
              isAsync: call.isAsync,
              callExpression: call.callExpression
            });
          }
        }
      }
    }

    return callers;
  }

  /**
   * Find all functions that this function calls
   */
  public findCallees(funcDef: FunctionDefinition): FunctionCall[] {
    return this.extractFunctionCalls(funcDef.filePath, funcDef.name);
  }

  /**
   * Trace execution path from start function to end function
   */
  public traceExecutionPath(startFunction: string, endFunction: string, maxDepth: number = 10): ExecutionPath[] {
    const paths: ExecutionPath[] = [];
    const visited = new Set<string>();

    const dfs = (current: string, currentPath: string[], currentFiles: string[], depth: number) => {
      if (depth > maxDepth) return;
      
      // Found the target
      if (current === endFunction) {
        const hasAsync = currentPath.some(fn => {
          const def = this.findFunctionDefinition(fn);
          return def?.type === 'async';
        });
        
        paths.push({
          path: [...currentPath, current],
          files: [...currentFiles],
          description: `${currentPath.join(' → ')} → ${current}`,
          isAsync: hasAsync,
          depth: depth + 1
        });
        return;
      }

      const key = `${current}-${depth}`;
      if (visited.has(key)) return;
      visited.add(key);

      const graph = this.analyzeCallGraph(current);
      if (!graph) return;

      for (const callee of graph.callees) {
        dfs(
          callee.callee,
          [...currentPath, current],
          [...currentFiles, callee.filePath],
          depth + 1
        );
      }
    };

    dfs(startFunction, [], [], 0);
    return paths;
  }

  /**
   * Get call tree showing nested function calls
   */
  public getCallTree(functionName: string, maxDepth: number = 3): CallTree | null {
    const funcDef = this.findFunctionDefinition(functionName);
    if (!funcDef) return null;

    const visited = new Set<string>();

    const buildTree = (funcName: string, depth: number): CallTree | null => {
      if (depth > maxDepth) return null;
      
      const def = this.findFunctionDefinition(funcName);
      if (!def) return null;

      const tree: CallTree = {
        function: funcName,
        file: this.getRelativePath(def.filePath),
        line: def.line,
        depth,
        calls: [],
        isRecursive: visited.has(funcName),
        isAsync: def.type === 'async'
      };

      if (visited.has(funcName)) {
        return tree;
      }

      visited.add(funcName);

      const callees = this.findCallees(def);
      for (const callee of callees) {
        const subtree = buildTree(callee.callee, depth + 1);
        if (subtree) {
          tree.calls.push(subtree);
        }
      }

      return tree;
    };

    return buildTree(functionName, 0);
  }

  /**
   * Find function definition across all files
   */
  public findFunctionDefinition(functionName: string): FunctionDefinition | null {
    const allFiles = this.getAllProjectFiles();

    for (const file of allFiles) {
      const functions = this.extractFunctions(file);
      const found = functions.find(f => f.name === functionName);
      if (found) return found;
    }

    return null;
  }

  /**
   * Extract all function definitions from a file
   */
  private extractFunctions(filePath: string): FunctionDefinition[] {
    // Check cache
    if (this.functionCache.has(filePath)) {
      return this.functionCache.get(filePath)!;
    }

    const content = this.readFile(filePath);
    const functions: FunctionDefinition[] = [];
    const lines = content.split('\n');

    let currentClass: string | undefined;

    lines.forEach((line, lineNumber) => {
      const trimmed = line.trim();

      // Class detection
      const classMatch = /class\s+(\w+)/.exec(trimmed);
      if (classMatch) {
        currentClass = classMatch[1];
      }

      // Regular function: function name() {}
      const funcMatch = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/.exec(trimmed);
      if (funcMatch) {
        functions.push({
          name: funcMatch[1],
          filePath,
          line: lineNumber + 1,
          type: trimmed.includes('async') ? 'async' : 'function',
          params: this.parseParams(funcMatch[2]),
          isExported: trimmed.includes('export'),
          className: currentClass
        });
        return;
      }

      // Arrow function: const name = () => {}
      const arrowMatch = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/.exec(trimmed);
      if (arrowMatch) {
        functions.push({
          name: arrowMatch[1],
          filePath,
          line: lineNumber + 1,
          type: 'arrow',
          params: this.parseParams(arrowMatch[2]),
          isExported: trimmed.includes('export')
        });
        return;
      }

      // Method: methodName() {} or async methodName() {}
      const methodMatch = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*[:{]/.exec(trimmed);
      if (methodMatch && currentClass && !trimmed.includes('function')) {
        const methodName = methodMatch[1];
        // Skip constructors and common keywords
        if (methodName !== 'constructor' && methodName !== 'if' && methodName !== 'while' && methodName !== 'for') {
          functions.push({
            name: methodName,
            filePath,
            line: lineNumber + 1,
            type: trimmed.includes('async') ? 'async' : 'method',
            params: this.parseParams(methodMatch[2]),
            isExported: false,
            className: currentClass
          });
        }
      }
    });

    this.functionCache.set(filePath, functions);
    return functions;
  }

  /**
   * Extract function calls from a specific function
   */
  private extractFunctionCalls(filePath: string, functionName: string): FunctionCall[] {
    const content = this.readFile(filePath);
    const lines = content.split('\n');
    const calls: FunctionCall[] = [];

    // Pre-compile regex for better performance (fixes regex-in-loops)
    const escapedFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const funcRegex = new RegExp(`(?:function\\s+${escapedFunctionName}|(?:const|let|var)\\s+${escapedFunctionName}\\s*=|${escapedFunctionName}\\s*\\()`);

    // Find the function's body
    let inFunction = false;
    let braceCount = 0;
    let functionStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if we're entering the target function
      if (!inFunction) {
        if (funcRegex.test(trimmed)) {
          inFunction = true;
          functionStartLine = i;
          braceCount = 0;
        }
        continue;
      }

      // Track braces
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Extract function calls in this line
      const callRegex = /(\w+)\s*\(/g;
      let match;
      
      while ((match = callRegex.exec(trimmed)) !== null) {
        const calledFunc = match[1];
        
        // Skip keywords and common patterns
        if (this.isKeyword(calledFunc)) continue;

        calls.push({
          caller: functionName,
          callee: calledFunc,
          line: i + 1,
          filePath,
          isAsync: trimmed.includes('await'),
          callExpression: trimmed
        });
      }

      // Exit function when braces are balanced
      if (braceCount === 0 && inFunction && i > functionStartLine) {
        break;
      }
    }

    return calls;
  }

  /**
   * Calculate call depth (longest chain from this function)
   */
  private calculateCallDepth(functionName: string, visited = new Set<string>()): number {
    if (visited.has(functionName)) return 0;
    visited.add(functionName);

    const funcDef = this.findFunctionDefinition(functionName);
    if (!funcDef) return 0;

    const callees = this.findCallees(funcDef);
    if (callees.length === 0) return 1;

    let maxDepth = 0;
    for (const callee of callees) {
      const depth = this.calculateCallDepth(callee.callee, new Set(visited));
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth + 1;
  }

  // Helper methods

  private parseParams(paramString: string): string[] {
    if (!paramString || !paramString.trim()) return [];
    return paramString.split(',').map(p => p.trim().split(/[:=]/)[0].trim());
  }

  private isKeyword(word: string): boolean {
    const keywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'return', 'throw', 'try', 'catch', 'finally', 'new', 'typeof', 'instanceof',
      'this', 'super', 'class', 'extends', 'import', 'export', 'default', 'const',
      'let', 'var', 'function', 'async', 'await', 'yield', 'delete', 'in', 'of'
    ];
    return keywords.includes(word);
  }

  private readFile(filePath: string): string {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }
    
    try {
      // Use intelligent skimming for function analysis
      const skimResult = skimForFunctions(filePath);
      
      if (!skimResult.content) {
        // Fallback to file size guard if skimming fails
        const guardResult = this.fileSizeGuard.readFile(filePath, 'utf-8');
        if (guardResult.skipped) {
          return ''; // Return empty string for skipped files to prevent crashes
        }
        const content = guardResult.content;
        this.fileCache.set(filePath, content);
        return content;
      }
      
      // Use skimmed content for function analysis
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

  private getAllProjectFiles(): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!['node_modules', 'dist', 'build', '.git', '.next', 'out', 'coverage'].includes(entry.name)) {
              walk(fullPath);
            }
          } else {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(this.workspacePath);
    return files;
  }

  /**
   * Clear caches
   */
  public clearCache() {
    this.fileCache.clear();
    this.functionCache.clear();
    this.callCache.clear();
  }
}