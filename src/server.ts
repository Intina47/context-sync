import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Storage } from './storage.js';
import { ProjectDetector } from './project-detector.js';
import { WorkspaceDetector } from './workspace-detector.js';
import { FileWriter } from './file-writer.js';
import { FileSearcher } from './file-searcher.js';
import { GitIntegration } from './git-integration.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { CallGraphAnalyzer } from './call-graph-analyzer.js';  
import { TypeAnalyzer } from './type-analyzer.js';
import { PlatformSync, type AIPlatform } from './platform-sync.js';   
import { TodoManager } from './todo-manager.js';
import { createTodoHandlers } from './todo-handlers.js';
import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { PathNormalizer } from './path-normalizer.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { todoToolDefinitions } from './todo-tools.js';
import type { ProjectContext } from './types.js';
import * as fs from 'fs';

export class ContextSyncServer {
  private server: Server;
  private storage: Storage;
  private projectDetector: ProjectDetector;
  private workspaceDetector: WorkspaceDetector;
  private fileWriter: FileWriter;
  private fileSearcher: FileSearcher;
  private gitIntegration: GitIntegration | null = null;
  private dependencyAnalyzer: DependencyAnalyzer | null = null; 
  private callGraphAnalyzer: CallGraphAnalyzer | null = null;
  private typeAnalyzer: TypeAnalyzer | null = null;
  private platformSync: PlatformSync;
  private todoManager: TodoManager;
  private todoHandlers: ReturnType<typeof createTodoHandlers>;
  
  // ✅ NEW: Session-specific current project
  private currentProjectId: string | null = null;

  constructor(storagePath?: string) {

    this.storage = new Storage(storagePath);
    this.projectDetector = new ProjectDetector(this.storage);
    this.workspaceDetector = new WorkspaceDetector(this.storage, this.projectDetector);
    this.fileWriter = new FileWriter(this.workspaceDetector, this.storage);
    this.fileSearcher = new FileSearcher(this.workspaceDetector);

    this.server = new Server(
      {
        name: 'context-sync',
        version: '0.6.1',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.platformSync = new PlatformSync(this.storage);
    this.todoManager = new TodoManager(this.storage.getDb());
    this.todoHandlers = createTodoHandlers(this.todoManager);
    // Auto-detect platform
    const detectedPlatform = PlatformSync.detectPlatform();
    this.platformSync.setPlatform(detectedPlatform);
    
    this.setupToolHandlers();
    this.setupPromptHandlers();
  }

  /**
   * Get the current version from package.json
   */
  private getVersion(): string {
    try {
      // Get the directory of the current module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      // Look for package.json in parent directories
      let currentDir = __dirname;
      while (currentDir !== dirname(currentDir)) {
        try {
          const packagePath = join(currentDir, 'package.json');
          const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
          if (packageJson.name === '@context-sync/server') {
            return packageJson.version;
          }
        } catch {
          // Continue searching in parent directory
        }
        currentDir = dirname(currentDir);
      }
      
      // Fallback: try to read from installed package location
      try {
        const installedPackagePath = join(process.cwd(), '..', '..', 'package.json');
        const packageJson = JSON.parse(readFileSync(installedPackagePath, 'utf8'));
        if (packageJson.name === '@context-sync/server') {
          return packageJson.version;
        }
      } catch {
        // Fallback failed
      }
      
      return '0.6.1'; // Fallback version
    } catch (error) {
      return '0.6.1'; // Fallback version
    }
  }

  /**
   * Get current project from session state
   */
  private getCurrentProject(): ProjectContext | null {
    if (!this.currentProjectId) return null;
    return this.storage.getProject(this.currentProjectId);
  }

  private setupPromptHandlers(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'project_context',
          description: 'Automatically inject active project context into conversation',
          arguments: [],
        },
      ],
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (request.params.name !== 'project_context') {
        throw new Error(`Unknown prompt: ${request.params.name}`);
      }

      const project = this.getCurrentProject();  
      if (!project) {
        return {
          description: 'No active project',
          messages: [],
        };
      }

      const summary = this.storage.getContextSummary(project.id);
      const contextMessage = this.buildContextPrompt(summary);

      return {
        description: `Context for ${project.name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: contextMessage,
            },
          },
        ],
      };
    });
  }

  private buildContextPrompt(summary: any): string {
    const { project, recentDecisions } = summary;

    let prompt = `[ACTIVE PROJECT CONTEXT - Auto-loaded]\n\n`;
    prompt += `📁 Project: ${project.name}\n`;

    if (project.architecture) {
      prompt += `🏗️  Architecture: ${project.architecture}\n`;
    }

    if (project.techStack && project.techStack.length > 0) {
      prompt += `⚙️  Tech Stack: ${project.techStack.join(', ')}\n`;
    }

    if (recentDecisions.length > 0) {
      prompt += `\n📋 Recent Decisions:\n`;
      recentDecisions.slice(0, 5).forEach((d: any, i: number) => {
        prompt += `${i + 1}. [${d.type}] ${d.description}`;
        if (d.reasoning) {
          prompt += ` - ${d.reasoning}`;
        }
        prompt += `\n`;
      });
    }

    const lastUpdated = new Date(project.updatedAt).toLocaleString();
    prompt += `\n🕐 Last Updated: ${lastUpdated}\n`;

    prompt += `\n---\n`;
    prompt += `FILE WRITING WORKFLOW (v0.3.0):\n\n`;
    prompt += `When user requests file creation/modification:\n`;
    prompt += `1. Call create_file/modify_file/delete_file → Shows preview\n`;
    prompt += `2. Ask user: "Should I proceed?" or "Approve this change?"\n`;
    prompt += `3. If user says yes/approve/go ahead:\n`;
    prompt += `   → Call apply_create_file/apply_modify_file/apply_delete_file\n`;
    prompt += `4. If user says no → Don't call apply tools\n\n`;
    prompt += `IMPORTANT: Always wait for explicit user approval before calling apply_* tools!\n`;

    return prompt;
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // V0.2.0 tools
        ...this.getV02Tools(),
        // V0.3.0 tools (including apply_* tools)
        ...this.getV03Tools(),
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // V0.2.0 handlers
      if (name === 'get_project_context') return this.handleGetContext();
      if (name === 'save_decision') return this.handleSaveDecision(args as any);
      if (name === 'save_conversation') return this.handleSaveConversation(args as any);

      if (name === 'set_workspace') return this.handleSetWorkspace(args as any);
      if (name === 'read_file') return this.handleReadFile(args as any);
      if (name === 'get_project_structure') return this.handleGetProjectStructure(args as any);
      if (name === 'scan_workspace') return this.handleScanWorkspace();

      // V0.3.0 - Preview tools
      if (name === 'create_file') return this.handleCreateFile(args as any);
      if (name === 'modify_file') return this.handleModifyFile(args as any);
      if (name === 'delete_file') return this.handleDeleteFile(args as any);
      
      // V0.3.0 - Apply tools (NEW!)
      if (name === 'apply_create_file') return this.handleApplyCreateFile(args as any);
      if (name === 'apply_modify_file') return this.handleApplyModifyFile(args as any);
      if (name === 'apply_delete_file') return this.handleApplyDeleteFile(args as any);
      
      // V0.3.0 - Other tools
      if (name === 'undo_file_change') return this.handleUndoFileChange(args as any);
      if (name === 'search_files') return this.handleSearchFiles(args as any);
      if (name === 'search_content') return this.handleSearchContent(args as any);
      if (name === 'find_symbol') return this.handleFindSymbol(args as any);
      if (name === 'git_status') return this.handleGitStatus();
      if (name === 'git_diff') return this.handleGitDiff(args as any);
      if (name === 'git_branch_info') return this.handleGitBranchInfo(args as any);
      if (name === 'suggest_commit_message') return this.handleSuggestCommitMessage(args as any);

      // V0.4.0 - Dependency Analysis
      if (name === 'analyze_dependencies') return this.handleAnalyzeDependencies(args as any);
      if (name === 'get_dependency_tree') return this.handleGetDependencyTree(args as any);
      if (name === 'find_importers') return this.handleFindImporters(args as any);
      if (name === 'detect_circular_deps') return this.handleDetectCircularDeps(args as any);

      // V0.4.0 - Call Graph Analysis (ADD THESE)
      if (name === 'analyze_call_graph') return this.handleAnalyzeCallGraph(args as any);
      if (name === 'find_callers') return this.handleFindCallers(args as any);
      if (name === 'trace_execution_path') return this.handleTraceExecutionPath(args as any);
      if (name === 'get_call_tree') return this.handleGetCallTree(args as any);

      // V0.4.0 - Type Analysis
      if (name === 'find_type_definition') return await this.handleFindTypeDefinition(args as any);
      if (name === 'get_type_info') return await this.handleGetTypeInfo(args as any);
      if (name === 'find_type_usages') return await this.handleFindTypeUsages(args as any);

      if (name === 'switch_platform') return this.handleSwitchPlatform(args as any);
      if (name === 'get_platform_status') return this.handleGetPlatformStatus();
      if (name === 'get_platform_context') return this.handleGetPlatformContext(args as any);
      if (name === 'setup_cursor') return this.handleSetupCursor();
      if (name === 'get_started') return this.handleGetStarted();
      if (name === 'debug_session') return this.handleDebugSession();
      if (name === 'get_performance_report') return this.handleGetPerformanceReport(args as any);
      // V0.4.0 - Todo Management Tools (with current project integration)
      if (name === 'todo_create') return this.handleTodoCreate(args as any);
      if (name === 'todo_get') return this.handleTodoGet(args as any);
      if (name === 'todo_list') return this.handleTodoList(args as any);
      if (name === 'todo_update') return this.handleTodoUpdate(args as any);
      if (name === 'todo_delete') return this.handleTodoDelete(args as any);
      if (name === 'todo_complete') return this.handleTodoComplete(args as any);
      if (name === 'todo_stats') return this.handleTodoStats(args as any);
      if (name === 'todo_tags') return this.handleTodoTags();

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  private getV02Tools() {
    return [
      {
        name: 'get_project_context',
        description: 'Get the current project context including recent decisions and conversations',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'save_decision',
        description: 'Save an important technical decision or architectural choice',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['architecture', 'library', 'pattern', 'configuration', 'other'] },
            description: { type: 'string' },
            reasoning: { type: 'string' },
          },
          required: ['type', 'description'],
        },
      },
      {
        name: 'save_conversation',
        description: 'Save a conversation snippet for future reference',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            role: { type: 'string', enum: ['user', 'assistant'] },
          },
          required: ['content', 'role'],
        },
      },

      {
        name: 'set_workspace',
        description: 'Set workspace directory and initialize project. Automatically detects project type, validates path, and offers to initialize Context Sync features with user consent. This is the primary command for starting work on any project.',
        inputSchema: {
          type: 'object',
          properties: { 
            path: { 
              type: 'string',
              description: 'Absolute path to the project directory (must exist and be accessible)'
            } 
          },
          required: ['path'],
        },
      },
      {
        name: 'read_file',
        description: 'Read a file from the current workspace',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
      {
        name: 'get_project_structure',
        description: 'Get the file/folder structure of current workspace',
        inputSchema: {
          type: 'object',
          properties: { depth: { type: 'number' } },
        },
      },
      {
        name: 'scan_workspace',
        description: 'Scan workspace and get overview of important files',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  private getV03Tools() {
    return [
      // Preview tools (show preview, don't apply)
      {
        name: 'create_file',
        description: 'Preview file creation (does NOT create the file yet)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path for new file' },
            content: { type: 'string', description: 'File content' },
            overwrite: { type: 'boolean', description: 'Overwrite if exists (default: false)' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'modify_file',
        description: 'Preview file modification (does NOT modify the file yet)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            changes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['replace', 'insert', 'delete'] },
                  line: { type: 'number', description: 'Line number for the change' },
                  oldText: { type: 'string', description: 'Text to be replaced or deleted' },
                  newText: { type: 'string', description: 'New text to insert or replace with' },
                },
                required: ['type', 'newText']
              },
              description: 'Array of file changes'
            },
          },
          required: ['path', 'changes'],
        },
      },
      {
        name: 'delete_file',
        description: 'Preview file deletion (does NOT delete the file yet)',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
      
      // Apply tools (actually perform the action)
      {
        name: 'apply_create_file',
        description: 'Actually create the file after user approval',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'apply_modify_file',
        description: 'Actually modify the file after user approval',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            changes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['replace', 'insert', 'delete']
                  },
                  line: {
                    type: 'number',
                    description: 'Line number for the change'
                  },
                  oldText: {
                    type: 'string',
                    description: 'Text to be replaced or deleted'
                  },
                  newText: {
                    type: 'string',
                    description: 'New text to insert or replace with'
                  }
                },
                required: ['type', 'newText']
              },
              description: 'Array of file changes to apply'
            },
          },
          required: ['path', 'changes'],
        },
      },
      {
        name: 'apply_delete_file',
        description: 'Actually delete the file after user approval',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
      
      // Other tools
      {
        name: 'undo_file_change',
        description: 'Undo the last modification to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            steps: { type: 'number', description: 'Number of changes to undo (default: 1)' },
          },
          required: ['path'],
        },
      },
      
      // Search tools
      {
        name: 'search_files',
        description: 'Search for files by name or pattern',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            maxResults: { type: 'number' },
            ignoreCase: { type: 'boolean' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'search_content',
        description: 'Search file contents for text or regex',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            regex: { type: 'boolean' },
            caseSensitive: { type: 'boolean' },
            filePattern: { type: 'string' },
            maxResults: { type: 'number' },
          },
          required: ['query'],
        },
      },
      {
        name: 'find_symbol',
        description: 'Find function, class, or variable definitions',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            type: { type: 'string', enum: ['function', 'class', 'variable', 'all'] },
          },
          required: ['symbol'],
        },
      },
      
      // Git tools
      {
        name: 'git_status',
        description: 'Check git repository status',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'git_diff',
        description: 'View git diff for file(s)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            staged: { type: 'boolean' },
          },
        },
      },
      {
        name: 'git_branch_info',
        description: 'Get git branch information',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['current', 'list', 'recent'] },
          },
        },
      },
      {
        name: 'suggest_commit_message',
        description: 'Suggest a commit message based on changes',
        inputSchema: {
          type: 'object',
          properties: {
            files: { type: 'array', items: { type: 'string' } },
            convention: { type: 'string', enum: ['conventional', 'simple', 'descriptive'] },
          },
        },
      },
        // V0.4.0 - Dependency Analysis Tools (ADD THESE)
            {
              name: 'analyze_dependencies',
              description: 'Analyze import/export dependencies for a file. Returns all imports, exports, files that import this file, and circular dependencies.',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: { 
                    type: 'string', 
                    description: 'Path to the file to analyze (relative to workspace)' 
                  },
                },
                required: ['filePath'],
              },
            },
            {
              name: 'get_dependency_tree',
              description: 'Get a tree view of all dependencies for a file, showing nested imports up to a specified depth.',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: { 
                    type: 'string',
                    description: 'Path to the file (relative to workspace)' 
                  },
                  depth: { 
                    type: 'number',
                    description: 'Maximum depth to traverse (default: 3, max: 10)' 
                  },
                },
                required: ['filePath'],
              },
            },
            {
              name: 'find_importers',
              description: 'Find all files that import a given file. Useful for understanding what depends on this file.',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: { 
                    type: 'string',
                    description: 'Path to the file (relative to workspace)' 
                  },
                },
                required: ['filePath'],
              },
            },
            {
              name: 'detect_circular_deps',
              description: 'Detect circular dependencies starting from a file. Shows all circular dependency chains.',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: { 
                    type: 'string',
                    description: 'Path to the file (relative to workspace)' 
                  },
                },
                required: ['filePath'],
              },
            },
                  // V0.4.0 - Call Graph Analysis Tools (ADD THESE)
      {
        name: 'analyze_call_graph',
        description: 'Analyze the call graph for a function. Shows what functions it calls (callees) and what functions call it (callers).',
        inputSchema: {
          type: 'object',
          properties: {
            functionName: { 
              type: 'string', 
              description: 'Name of the function to analyze' 
            },
          },
          required: ['functionName'],
        },
      },
      {
        name: 'find_callers',
        description: 'Find all functions that call a given function. Useful for impact analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            functionName: { 
              type: 'string',
              description: 'Name of the function' 
            },
          },
          required: ['functionName'],
        },
      },
      {
        name: 'trace_execution_path',
        description: 'Trace all possible execution paths from one function to another. Shows the call chain.',
        inputSchema: {
          type: 'object',
          properties: {
            startFunction: { 
              type: 'string',
              description: 'Starting function name' 
            },
            endFunction: { 
              type: 'string',
              description: 'Target function name' 
            },
            maxDepth: { 
              type: 'number',
              description: 'Maximum depth to search (default: 10)' 
            },
          },
          required: ['startFunction', 'endFunction'],
        },
      },
      {
        name: 'get_call_tree',
        description: 'Get a tree view of function calls starting from a given function.',
        inputSchema: {
          type: 'object',
          properties: {
            functionName: { 
              type: 'string',
              description: 'Name of the function' 
            },
            depth: { 
              type: 'number',
              description: 'Maximum depth (default: 3)' 
            },
          },
          required: ['functionName'],
        },
      },

      // V0.4.0 - Type Analysis Tools (ADD THESE)
      {
        name: 'find_type_definition',
        description: 'Find where a type, interface, class, or enum is defined.',
        inputSchema: {
          type: 'object',
          properties: {
            typeName: { 
              type: 'string', 
              description: 'Name of the type to find' 
            },
          },
          required: ['typeName'],
        },
      },
      {
        name: 'get_type_info',
        description: 'Get complete information about a type including properties, methods, and usage.',
        inputSchema: {
          type: 'object',
          properties: {
            typeName: { 
              type: 'string',
              description: 'Name of the type' 
            },
          },
          required: ['typeName'],
        },
      },
      {
        name: 'find_type_usages',
        description: 'Find all places where a type is used in the codebase.',
        inputSchema: {
          type: 'object',
          properties: {
            typeName: { 
              type: 'string',
              description: 'Name of the type' 
            },
          },
          required: ['typeName'],
        },
      },
      {
        name: 'switch_platform',
        description: 'Switch between AI platforms (Claude ↔ Cursor) with full context handoff',
        inputSchema: {
          type: 'object',
          properties: {
            fromPlatform: {
              type: 'string',
              enum: ['claude', 'cursor', 'copilot', 'other'],
              description: 'Platform you are switching from',
            },
            toPlatform: {
              type: 'string',
              enum: ['claude', 'cursor', 'copilot', 'other'],
              description: 'Platform you are switching to',
            },
          },
          required: ['fromPlatform', 'toPlatform'],
        },
      },
      {
        name: 'get_platform_status',
        description: 'Check which AI platforms have Context Sync configured',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_platform_context',
        description: 'Get context specific to a platform (conversations, decisions)',
        inputSchema: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: ['claude', 'cursor', 'copilot', 'other'],
              description: 'Platform to get context for (defaults to current platform)',
            },
          },
        },
      },
      {
        name: 'setup_cursor',
        description: 'Get instructions for setting up Context Sync in Cursor IDE',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_started',
        description: 'Get started with Context Sync - shows installation status, current state, and guided next steps',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'debug_session',
        description: 'Debug session state and project information for multi-project testing',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_performance_report',
        description: 'Get performance metrics and statistics for database operations and system performance',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'Specific operation to get stats for (optional)',
            },
            reset: {
              type: 'boolean',
              description: 'Reset stats after reporting (default: false)',
            },
          },
        },
      },
      // V0.4.0 - Todo Management Tools (ADD THESE)
      ...todoToolDefinitions,
    ];
  }

  // ========== V0.2.0 HANDLERS ==========

  private handleGetContext() {
    const project = this.getCurrentProject();
    
    if (!project) {
      return {
        content: [{
          type: 'text',
          text: 'No active project. Use set_workspace to create one.',
        }],
      };
    }

    const summary = this.storage.getContextSummary(project.id);
    return {
      content: [{
        type: 'text',
        text: this.formatContextSummary(summary),
      }],
    };
  }

  private handleSaveDecision(args: any) {
    const project = this.getCurrentProject();
    
    if (!project) {
      return {
        content: [{ type: 'text', text: 'No active project. Use set_workspace first.' }],
      };
    }

    const decision = this.storage.addDecision({
      projectId: project.id,
      type: args.type,
      description: args.description,
      reasoning: args.reasoning,
    });

    return {
      content: [{ type: 'text', text: `Decision saved: ${decision.description}` }],
    };
  }

  private handleSaveConversation(args: any) {
    const project = this.getCurrentProject();
    
    if (!project) {
      return {
        content: [{ type: 'text', text: 'No active project. Use set_workspace first.' }],
      };
    }

    this.storage.addConversation({
      projectId: project.id,
      tool: 'claude',
      role: args.role,
      content: args.content,
    });

    return {
      content: [{ type: 'text', text: 'Conversation saved to project context.' }],
    };
  }



  private async handleSetWorkspace(args: any) {
    try {
      // 0. NORMALIZE PATH for consistent handling
      const normalizedPath = PathNormalizer.normalize(args.path);
      const displayPath = PathNormalizer.getDisplayPath(args.path);

      // 1. STRICT PATH VALIDATION - Fail fast on invalid paths
      await this.validatePathStrict(normalizedPath);

      // 2. CHECK IF PROJECT ALREADY EXISTS IN DATABASE
      const existingProject = this.storage.findProjectByPath(normalizedPath);
      if (existingProject) {
        return await this.useExistingProject(normalizedPath, existingProject, displayPath);
      }

      // 3. DETECT PROJECT FROM FILESYSTEM - Thorough detection  
      const detectedMetadata = await this.detectProjectFromPathStrict(normalizedPath);
      if (detectedMetadata) {
        return this.requestProjectInitialization(normalizedPath, detectedMetadata, displayPath);
      }

      // 4. NO PROJECT DETECTED - OFFER OPTIONS
      return this.requestGenericInitialization(normalizedPath, displayPath);

    } catch (error) {
      return this.createErrorResponse(error, args.path);
    }
  }

  // ========== STRICT INTERNAL FUNCTIONS WITH ROBUST VALIDATION ==========

  /**
   * Strict path validation - throws descriptive errors for any path issues
   */
  private async validatePathStrict(path: string): Promise<void> {
    if (!path || typeof path !== 'string') {
      throw new Error('Path is required and must be a string');
    }

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      throw new Error('Path cannot be empty or just whitespace');
    }

    // Check if path exists
    let stats;
    try {
      stats = await fs.promises.stat(trimmedPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory does not exist: ${trimmedPath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied accessing: ${trimmedPath}`);
      } else if (error.code === 'ENOTDIR') {
        throw new Error(`Path exists but is not a directory: ${trimmedPath}`);
      } else {
        throw new Error(`Cannot access path "${trimmedPath}": ${error.message}`);
      }
    }

    // Verify it's actually a directory
    if (!stats.isDirectory()) {
      throw new Error(`Path exists but is not a directory: ${trimmedPath}`);
    }

    // Check read permissions by trying to list contents
    try {
      await fs.promises.readdir(trimmedPath);
    } catch (error: any) {
      throw new Error(`Cannot read directory contents: ${trimmedPath} (${error.message})`);
    }
  }

  /**
   * Strict project detection - only returns metadata for valid, detectable projects
   */
  private async detectProjectFromPathStrict(path: string): Promise<any | null> {
    try {
      // Use existing project detector but with additional validation
      const metadata = await this.projectDetector.detectFromPath(path);
      
      if (!metadata) {
        return null; // No project detected - this is fine
      }

      // Validate detected metadata is actually valid
      if (!metadata.name || !metadata.type) {
        console.warn(`Invalid project metadata detected at ${path}:`, metadata);
        return null;
      }

      // Ensure tech stack is valid
      if (!Array.isArray(metadata.techStack)) {
        console.warn(`Invalid tech stack in project metadata at ${path}:`, metadata.techStack);
        metadata.techStack = [];
      }

      return metadata;

    } catch (error) {
      console.error(`Error detecting project at ${path}:`, error);
      return null; // Don't throw - just return null for undetectable projects
    }
  }

  /**
   * Use existing project with full workspace setup
   */
  private async useExistingProject(path: string, project: any, displayPath?: string) {
    try {
      // Set up workspace and analyzers
      await this.initializeWorkspaceStrict(path);
      
      // Set as current project in session
      this.currentProjectId = project.id;
      
      const structure = await this.workspaceDetector.getProjectStructure(2);
      const isGit = this.gitIntegration?.isGitRepo() ? ' (Git repo ✓)' : '';
      
      return {
        content: [{
          type: 'text',
          text: `✅ **Workspace Connected**: ${path}${isGit}\n\n📁 **Project**: ${project.name}\n⚙️  **Tech Stack**: ${project.techStack.join(', ') || 'None'}\n🏗️  **Architecture**: ${project.architecture || 'Not specified'}\n\n📂 **Structure Preview**:\n${structure}\n\n🎯 **Ready!** All Context Sync features are active for this project.\n\n**Available**:\n• Project-specific todos\n• Decision tracking\n• Git integration\n• Code analysis tools`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to set up existing project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Request user consent for project initialization
   */
  private requestProjectInitialization(path: string, metadata: any, displayPath?: string) {
    return {
      content: [{
        type: 'text',
        text: `🔍 **Project Detected!**\n\n📁 **Name**: ${metadata.name}\n🏗️  **Type**: ${metadata.type}\n⚙️  **Tech Stack**: ${metadata.techStack.join(', ')}\n${metadata.architecture ? `🏛️  **Architecture**: ${metadata.architecture}\n` : ''}\n**Initialize this project in Context Sync?**\n\n✅ **Benefits**:\n• Project-specific todos and decisions\n• Context tracking across AI sessions\n• Git integration and code analysis\n• Shared memory between AI platforms\n\n**Commands**:\n• \`"yes"\` or \`"initialize"\` to proceed\n• \`"no"\` or \`"skip"\` to use as basic workspace\n\n*Note: You can always initialize later if you change your mind.*`
      }]
    };
  }

  /**
   * Request user choice for generic initialization
   */
  private requestGenericInitialization(path: string, displayPath?: string) {
    return {
      content: [{
        type: 'text',
        text: `📂 **Directory Validated**: ${path}\n\nNo specific project type detected (no package.json, Cargo.toml, etc.)\n\n**Choose your setup**:\n\n**1. 🚀 Full Project** (Recommended)\n• Enable todos and decision tracking\n• Full Context Sync features\n• Project-specific context\n• Cross-platform sync\n\n**2. 📁 Basic Workspace**\n• File operations only\n• No project tracking\n• Minimal features\n\n**Commands**:\n• \`"1"\` or \`"full"\` for complete project setup\n• \`"2"\` or \`"basic"\` for workspace-only mode`
      }]
    };
  }

  /**
   * Initialize workspace with all analyzers - strict validation
   */
  private async initializeWorkspaceStrict(path: string): Promise<void> {
    try {
      // Set workspace detector
      this.workspaceDetector.setWorkspace(path);
      
      // Initialize analyzers with error handling
      try {
        this.gitIntegration = new GitIntegration(path);
      } catch (error) {
        console.warn(`Git integration failed for ${path}:`, error);
        this.gitIntegration = null;
      }

      try {
        this.dependencyAnalyzer = new DependencyAnalyzer(path);
      } catch (error) {
        console.warn(`Dependency analyzer failed for ${path}:`, error);
        this.dependencyAnalyzer = null;
      }

      try {
        this.callGraphAnalyzer = new CallGraphAnalyzer(path);
      } catch (error) {
        console.warn(`Call graph analyzer failed for ${path}:`, error);
        this.callGraphAnalyzer = null;
      }

      try {
        this.typeAnalyzer = new TypeAnalyzer(path);
      } catch (error) {
        console.warn(`Type analyzer failed for ${path}:`, error);
        this.typeAnalyzer = null;
      }

    } catch (error) {
      throw new Error(`Failed to initialize workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize a new project with strict validation
   */
  private async initializeProjectStrict(path: string, metadata?: any, customName?: string): Promise<any> {
    try {
      // Validate inputs
      if (!path) {
        throw new Error('Path is required for project initialization');
      }

      // Re-validate path still exists (safety check)
      await this.validatePathStrict(path);

      // Create project name
      const projectName = customName || metadata?.name || basename(path);
      if (!projectName || projectName.trim().length === 0) {
        throw new Error('Project name cannot be empty');
      }

      // Create project in database
      const project = this.storage.createProject(projectName.trim(), path);
      if (!project || !project.id) {
        throw new Error('Failed to create project in database');
      }
      
      // Update with metadata if available
      if (metadata) {
        try {
          this.storage.updateProject(project.id, {
            techStack: Array.isArray(metadata.techStack) ? metadata.techStack : [],
            architecture: metadata.architecture || undefined,
          });
        } catch (error) {
          console.warn('Failed to update project metadata:', error);
          // Continue - project creation succeeded even if metadata update failed
        }
      }
      
      // Set as current project in session
      this.currentProjectId = project.id;
      
      // Initialize workspace
      await this.initializeWorkspaceStrict(path);
      
      // Return success response
      return await this.createSuccessResponse(path, project);
      
    } catch (error) {
      throw new Error(`Project initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create comprehensive success response
   */
  private async createSuccessResponse(path: string, project: any) {
    try {
      const structure = await this.workspaceDetector.getProjectStructure(2);
      const isGit = this.gitIntegration?.isGitRepo() ? ' (Git repo ✓)' : '';
      
      return {
        content: [{
          type: 'text',
          text: `🎉 **Project Initialized Successfully!**\n\n✅ **Workspace**: ${path}${isGit}\n📁 **Project**: ${project.name}\n⚙️  **Tech Stack**: ${project.techStack?.join(', ') || 'None'}\n🏗️  **Architecture**: ${project.architecture || 'Generic'}\n\n📂 **Structure Preview**:\n${structure}\n\n🚀 **Context Sync Active!**\n\n**Available Commands**:\n• \`todo_create "task"\` - Add project todos\n• \`save_decision "choice"\` - Record decisions\n• \`git_status\` - Check repository status\n• \`search_content "term"\` - Find code\n• \`get_project_context\` - View project info\n\n**Pro Tip**: All todos and decisions are now linked to "${project.name}" automatically!`
        }]
      };
    } catch (error) {
      // Fallback response if structure preview fails
      return {
        content: [{
          type: 'text',
          text: `🎉 **Project Initialized**: ${project.name}\n✅ **Workspace**: ${path}\n\n🚀 Context Sync is now active for this project!`
        }]
      };
    }
  }

  /**
   * Create comprehensive error response
   */
  private createErrorResponse(error: any, path?: string) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      content: [{
        type: 'text',
        text: `❌ **Workspace Setup Failed**\n\n**Error**: ${errorMessage}\n\n**Path**: ${path || 'Not provided'}\n\n**Common Solutions**:\n• Verify the directory path exists\n• Check you have read permissions\n• Ensure path points to a directory (not a file)\n• Try using an absolute path\n\n**Need Help?** Double-check the path and try again.`
      }],
      isError: true
    };
  }

  private async handleReadFile(args: any) {
    try {
      const file = await this.workspaceDetector.readFile(args.path);
      
      if (!file) {
        return {
          content: [{
            type: 'text',
            text: `File not found: ${args.path}\n\nMake sure:\n1. Workspace is set (use set_workspace)\n2. Path is relative to workspace root\n3. File exists`,
          }],
        };
      }

      const sizeKB = file.size / 1024;
      let sizeWarning = '';
      if (sizeKB > 100) {
        sizeWarning = `\n⚠️  Large file (${sizeKB.toFixed(1)}KB) - showing full content\n`;
      }

      return {
        content: [{
          type: 'text',
          text: `📄 ${file.path} (${file.language})${sizeWarning}\n\`\`\`${file.language.toLowerCase()}\n${file.content}\n\`\`\``,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }

  private async handleGetProjectStructure(args: any) {
    try {
      const depth = args.depth || 3;
      const structure = await this.workspaceDetector.getProjectStructure(depth);

      if (!structure || structure === 'No workspace open') {
        return {
          content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
        };
      }

      return {
        content: [{ type: 'text', text: `📂 Project Structure (depth: ${depth}):\n\n${structure}` }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error getting structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }

  private async handleScanWorkspace() {
    try {
      const snapshot = await this.workspaceDetector.createSnapshot();

      if (!snapshot.rootPath) {
        return {
          content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
        };
      }

      let response = `📊 Workspace Scan Results\n\n`;
      response += `📁 Root: ${snapshot.rootPath}\n\n`;
      response += `${snapshot.summary}\n\n`;
      response += `📂 Structure:\n${snapshot.structure}\n\n`;
      response += `📋 Scanned ${snapshot.files.length} important files:\n`;
      
      snapshot.files.forEach(f => {
        const icon = f.language.includes('TypeScript') ? '📘' : 
                     f.language.includes('JavaScript') ? '📜' : 
                     f.language === 'JSON' ? '📋' : '📄';
        response += `${icon} ${f.path} (${f.language}, ${(f.size / 1024).toFixed(1)}KB)\n`;
      });

      response += `\nUse read_file to view any specific file!`;

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error scanning workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }

  // ========== V0.3.0 HANDLERS - PREVIEW TOOLS ==========

  private async handleCreateFile(args: any) {
    const result = await this.fileWriter.createFile(
      args.path,
      args.content,
      args.overwrite || false
    );

    if (!result.success) {
      return {
        content: [{ type: 'text', text: result.message }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: result.preview + '\n\n⚠️  This is a PREVIEW only. To actually create this file, user must approve and you must call apply_create_file with the same parameters.',
      }],
    };
  }

  private async handleModifyFile(args: any) {
    const result = await this.fileWriter.modifyFile(args.path, args.changes);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: result.message }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: result.preview + '\n\n⚠️  This is a PREVIEW only. To actually modify this file, user must approve and you must call apply_modify_file with the same parameters.',
      }],
    };
  }

  private async handleDeleteFile(args: any) {
    const result = await this.fileWriter.deleteFile(args.path);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: result.message }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: result.preview + '\n\n⚠️  This is a PREVIEW only. To actually delete this file, user must approve and you must call apply_delete_file with the same path.',
      }],
    };
  }

  // ========== V0.3.0 HANDLERS - APPLY TOOLS (NEW!) ==========

  private async handleApplyCreateFile(args: any) {
    const result = await this.fileWriter.applyCreateFile(args.path, args.content);
    return {
      content: [{ type: 'text', text: result.message }],
    };
  }

  private async handleApplyModifyFile(args: any) {
    const result = await this.fileWriter.applyModifyFile(args.path, args.changes);
    return {
      content: [{ type: 'text', text: result.message }],
    };
  }

  private async handleApplyDeleteFile(args: any) {
    const result = await this.fileWriter.applyDeleteFile(args.path);
    return {
      content: [{ type: 'text', text: result.message }],
    };
  }

  // ========== V0.3.0 HANDLERS - OTHER TOOLS ==========

  private async handleUndoFileChange(args: any) {
    const result = await this.fileWriter.undoChange(
      args.path,
      args.steps || 1
    );

    return {
      content: [{ type: 'text', text: result.message }],
    };
  }

  private handleSearchFiles(args: any) {
    const results = this.fileSearcher.searchFiles(args.pattern, {
      maxResults: args.maxResults,
      ignoreCase: args.ignoreCase,
    });

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No files found matching pattern: "${args.pattern}"`,
        }],
      };
    }

    let response = `🔍 Found ${results.length} files matching "${args.pattern}":\n\n`;
    
    results.forEach((file, i) => {
      const size = (file.size / 1024).toFixed(1);
      response += `${i + 1}. ${file.path} (${file.language}, ${size}KB)\n`;
    });

    response += `\nUse read_file to view any of these files.`;

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  private handleSearchContent(args: any) {
    const results = this.fileSearcher.searchContent(args.query, {
      regex: args.regex,
      caseSensitive: args.caseSensitive,
      filePattern: args.filePattern,
      maxResults: args.maxResults,
    });

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No matches found for: "${args.query}"`,
        }],
      };
    }

    let response = `🔍 Found ${results.length} matches for "${args.query}":\n\n`;
    
    results.slice(0, 20).forEach((match, i) => {
      response += `${i + 1}. ${match.path}:${match.line}\n`;
      response += `   ${match.content}\n\n`;
    });

    if (results.length > 20) {
      response += `... and ${results.length - 20} more matches`;
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  private handleFindSymbol(args: any) {
    const results = this.fileSearcher.findSymbol(args.symbol, args.type);

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `Symbol "${args.symbol}" not found`,
        }],
      };
    }

    let response = `🔍 Found ${results.length} definition(s) of "${args.symbol}":\n\n`;
    
    results.forEach((match, i) => {
      response += `${i + 1}. ${match.path}:${match.line}\n`;
      response += `   ${match.content}\n\n`;
    });

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  private handleGitStatus() {
    if (!this.gitIntegration) {
      return {
        content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
      };
    }

    const status = this.gitIntegration.getStatus();

    if (!status) {
      return {
        content: [{ type: 'text', text: 'Not a git repository' }],
      };
    }

    let response = `🔄 Git Status\n\n`;
    response += `📍 Branch: ${status.branch}`;
    
    if (status.ahead > 0) response += ` (ahead ${status.ahead})`;
    if (status.behind > 0) response += ` (behind ${status.behind})`;
    response += `\n\n`;

    if (status.clean) {
      response += `✅ Working tree clean`;
    } else {
      if (status.staged.length > 0) {
        response += `📝 Staged (${status.staged.length}):\n`;
        status.staged.slice(0, 10).forEach(f => response += `  • ${f}\n`);
        if (status.staged.length > 10) {
          response += `  ... and ${status.staged.length - 10} more\n`;
        }
        response += `\n`;
      }

      if (status.modified.length > 0) {
        response += `✏️  Modified (${status.modified.length}):\n`;
        status.modified.slice(0, 10).forEach(f => response += `  • ${f}\n`);
        if (status.modified.length > 10) {
          response += `  ... and ${status.modified.length - 10} more\n`;
        }
        response += `\n`;
      }

      if (status.untracked.length > 0) {
        response += `❓ Untracked (${status.untracked.length}):\n`;
        status.untracked.slice(0, 10).forEach(f => response += `  • ${f}\n`);
        if (status.untracked.length > 10) {
          response += `  ... and ${status.untracked.length - 10} more\n`;
        }
      }
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  private handleGitDiff(args: any) {
    if (!this.gitIntegration) {
      return {
        content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
      };
    }

    const diff = this.gitIntegration.getDiff(args.path, args.staged);

    if (!diff) {
      return {
        content: [{ type: 'text', text: 'Not a git repository or no changes' }],
      };
    }

    if (diff.trim().length === 0) {
      return {
        content: [{ type: 'text', text: 'No changes to show' }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📊 Git Diff${args.staged ? ' (staged)' : ''}:\n\n\`\`\`diff\n${diff}\n\`\`\``,
      }],
    };
  }

  private handleGitBranchInfo(args: any) {
    if (!this.gitIntegration) {
      return {
        content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
      };
    }

    const info = this.gitIntegration.getBranchInfo(args.action || 'current');

    if (!info) {
      return {
        content: [{ type: 'text', text: 'Not a git repository' }],
      };
    }

    if (typeof info === 'string') {
      return {
        content: [{ type: 'text', text: `📍 Current branch: ${info}` }],
      };
    }

    let response = `📍 Git Branches\n\n`;
    response += `Current: ${info.current}\n\n`;

    if (info.all.length > 0) {
      response += `All branches (${info.all.length}):\n`;
      info.all.slice(0, 20).forEach(b => {
        const marker = b === info.current ? '→ ' : '  ';
        response += `${marker}${b}\n`;
      });
    }

    if (info.recent.length > 0) {
      response += `\nRecent branches:\n`;
      info.recent.forEach(b => {
        const marker = b.name === info.current ? '→ ' : '  ';
        response += `${marker}${b.name} (${b.lastCommit})\n`;
      });
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  private handleSuggestCommitMessage(args: any) {
    if (!this.gitIntegration) {
      return {
        content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
      };
    }

    const message = this.gitIntegration.suggestCommitMessage(
      args.files || [],
      args.convention || 'conventional'
    );

    if (!message) {
      return {
        content: [{ type: 'text', text: 'Not a git repository or no changes to commit' }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `💬 Suggested Commit Message:\n\n\`\`\`\n${message}\n\`\`\``,
      }],
    };
  }

  private formatContextSummary(summary: any): string {
    const { project, recentDecisions, keyPoints } = summary;

    let text = `# Project: ${project.name}\n\n`;

    if (project.architecture) {
      text += `**Architecture:** ${project.architecture}\n\n`;
    }

    if (project.techStack.length > 0) {
      text += `**Tech Stack:** ${project.techStack.join(', ')}\n\n`;
    }

    if (recentDecisions.length > 0) {
      text += `## Recent Decisions\n\n`;
      recentDecisions.forEach((d: any) => {
        text += `- **${d.type}**: ${d.description}\n`;
        if (d.reasoning) {
          text += `  *Reasoning: ${d.reasoning}*\n`;
        }
      });
      text += '\n';
    }

    if (keyPoints.length > 0) {
      text += `## Key Context Points\n\n`;
      keyPoints.slice(0, 10).forEach((point: string) => {
        text += `- ${point}\n`;
      });
    }

    return text;
  }

 // ========== V0.4.0 HANDLERS - DEPENDENCY ANALYSIS ==========
 private handleAnalyzeDependencies(args: any) {
  if (!this.dependencyAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const graph = this.dependencyAnalyzer.analyzeDependencies(args.filePath);
    
    let response = `📊 Dependency Analysis: ${graph.filePath}\n\n`;
    
    // Imports
    if (graph.imports.length > 0) {
      response += `📥 Imports (${graph.imports.length}):\n`;
      graph.imports.forEach(imp => {
        const type = imp.isExternal ? '📦 [external]' : '📄 [local]';
        const names = imp.importedNames.length > 0 ? `{ ${imp.importedNames.join(', ')} }` : 
                      imp.defaultImport ? imp.defaultImport :
                      imp.namespaceImport ? `* as ${imp.namespaceImport}` : '';
        response += `  ${type} ${imp.source}${names ? ` - ${names}` : ''} (line ${imp.line})\n`;
      });
      response += '\n';
    }
    
    // Exports
    if (graph.exports.length > 0) {
      response += `📤 Exports (${graph.exports.length}):\n`;
      graph.exports.forEach(exp => {
        if (exp.hasDefaultExport) {
          response += `  • default export (line ${exp.line})\n`;
        }
        if (exp.exportedNames.length > 0) {
          response += `  • ${exp.exportedNames.join(', ')} (line ${exp.line})\n`;
        }
      });
      response += '\n';
    }
    
    // Importers
    if (graph.importers.length > 0) {
      response += `👥 Imported by (${graph.importers.length} files):\n`;
      graph.importers.slice(0, 10).forEach(file => {
        const relativePath = file.replace(this.dependencyAnalyzer!['workspacePath'], '').replace(/^[\\\/]/, '');
        response += `  • ${relativePath}\n`;
      });
      if (graph.importers.length > 10) {
        response += `  ... and ${graph.importers.length - 10} more files\n`;
      }
      response += '\n';
    }
    
    // Circular dependencies
    if (graph.circularDeps.length > 0) {
      response += `⚠️  Circular Dependencies (${graph.circularDeps.length}):\n`;
      graph.circularDeps.forEach(cycle => {
        response += `  • ${cycle.description}\n`;
      });
    } else {
      response += `✅ No circular dependencies detected\n`;
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error analyzing dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private handleGetDependencyTree(args: any) {
  if (!this.dependencyAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const depth = Math.min(args.depth || 3, 10);
    const tree = this.dependencyAnalyzer.getDependencyTree(args.filePath, depth);
    
    const formatTree = (node: any, indent: string = '', isLast: boolean = true): string => {
      const prefix = isLast ? '└── ' : '├── ';
      const icon = node.isExternal ? '📦' : node.isCyclic ? '🔄' : '📄';
      let result = `${indent}${prefix}${icon} ${node.file}${node.isCyclic ? ' (circular)' : ''}\n`;
      
      if (node.imports && node.imports.length > 0) {
        const newIndent = indent + (isLast ? '    ' : '│   ');
        node.imports.forEach((child: any, i: number) => {
          result += formatTree(child, newIndent, i === node.imports.length - 1);
        });
      }
      
      return result;
    };
    
    let response = `🌲 Dependency Tree (depth: ${depth})\n\n`;
    response += formatTree(tree);
    
    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error getting dependency tree: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private handleFindImporters(args: any) {
  if (!this.dependencyAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const importers = this.dependencyAnalyzer.findImporters(args.filePath);
    
    if (importers.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No files import ${args.filePath}\n\nThis file is either:\n- Not imported anywhere (unused)\n- An entry point\n- Only imported by external packages`,
        }],
      };
    }
    
    let response = `👥 Files that import ${args.filePath} (${importers.length}):\n\n`;
    
    importers.forEach((file, i) => {
      const relativePath = file.replace(this.dependencyAnalyzer!['workspacePath'], '').replace(/^[\\\/]/, '');
      response += `${i + 1}. ${relativePath}\n`;
    });
    
    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error finding importers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private handleDetectCircularDeps(args: any) {
  if (!this.dependencyAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const cycles = this.dependencyAnalyzer.detectCircularDependencies(args.filePath);
    
    if (cycles.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `✅ No circular dependencies detected for ${args.filePath}`,
        }],
      };
    }
    
    let response = `⚠️  Circular Dependencies Detected (${cycles.length}):\n\n`;
    
    cycles.forEach((cycle, i) => {
      response += `${i + 1}. ${cycle.description}\n`;
      response += `   Path: ${cycle.cycle.map(f => {
        return f.replace(this.dependencyAnalyzer!['workspacePath'], '').replace(/^[\\\/]/, '');
      }).join(' → ')}\n\n`;
    });
    
    response += `\n💡 Tip: Circular dependencies can cause:\n`;
    response += `- Module initialization issues\n`;
    response += `- Bundler problems\n`;
    response += `- Harder to understand code\n`;
    response += `\nConsider refactoring by extracting shared code to a separate module.`;
    
    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error detecting circular dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
} 

// ========== V0.4.0 HANDLERS - CALL GRAPH ANALYSIS ==========

private handleAnalyzeCallGraph(args: any) {
  if (!this.callGraphAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const graph = this.callGraphAnalyzer.analyzeCallGraph(args.functionName);
    
    if (!graph) {
      return {
        content: [{
          type: 'text',
          text: `Function "${args.functionName}" not found in workspace.`,
        }],
      };
    }

    let response = `📊 Call Graph Analysis: ${graph.function.name}\n\n`;
    
    // Function info
    response += `📍 Location: ${this.getRelativePath(graph.function.filePath)}:${graph.function.line}\n`;
    response += `🔧 Type: ${graph.function.type}`;
    if (graph.function.className) {
      response += ` (in class ${graph.function.className})`;
    }
    response += `\n`;
    response += `📊 Call depth: ${graph.callDepth}\n`;
    if (graph.isRecursive) {
      response += `🔄 Recursive: Yes\n`;
    }
    response += `\n`;

    // Callers (who calls this function)
    if (graph.callers.length > 0) {
      response += `👥 Called by (${graph.callers.length} functions):\n`;
      graph.callers.slice(0, 10).forEach(caller => {
        const file = this.getRelativePath(caller.filePath);
        const asyncMark = caller.isAsync ? ' (async)' : '';
        response += `  • ${caller.caller}${asyncMark} - ${file}:${caller.line}\n`;
      });
      if (graph.callers.length > 10) {
        response += `  ... and ${graph.callers.length - 10} more\n`;
      }
      response += `\n`;
    } else {
      response += `👥 Not called by any function (entry point or unused)\n\n`;
    }

    // Callees (what this function calls)
    if (graph.callees.length > 0) {
      response += `📞 Calls (${graph.callees.length} functions):\n`;
      graph.callees.slice(0, 10).forEach(callee => {
        const file = this.getRelativePath(callee.filePath);
        const asyncMark = callee.isAsync ? ' (await)' : '';
        response += `  • ${callee.callee}${asyncMark} - ${file}:${callee.line}\n`;
      });
      if (graph.callees.length > 10) {
        response += `  ... and ${graph.callees.length - 10} more\n`;
      }
    } else {
      response += `📞 Doesn't call any functions (leaf function)\n`;
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error analyzing call graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private handleFindCallers(args: any) {
  if (!this.callGraphAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const callers = this.callGraphAnalyzer.findCallers(args.functionName);
    
    if (callers.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No functions call "${args.functionName}".\n\nThis function might be:\n- An entry point\n- Unused code\n- Only called externally`,
        }],
      };
    }

    let response = `👥 Functions that call "${args.functionName}" (${callers.length}):\n\n`;
    
    callers.forEach((caller, i) => {
      const file = this.getRelativePath(caller.filePath);
      const asyncMark = caller.isAsync ? '⏳' : '  ';
      response += `${i + 1}. ${asyncMark} ${caller.caller}\n`;
      response += `   📍 ${file}:${caller.line}\n`;
      response += `   💬 ${caller.callExpression}\n\n`;
    });

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error finding callers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private handleTraceExecutionPath(args: any) {
  if (!this.callGraphAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const paths = this.callGraphAnalyzer.traceExecutionPath(
      args.startFunction,
      args.endFunction,
      args.maxDepth || 10
    );

    if (paths.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No execution path found from "${args.startFunction}" to "${args.endFunction}".\n\nPossible reasons:\n- Functions are not connected\n- Path exceeds max depth\n- One or both functions don't exist`,
        }],
      };
    }

    let response = `🛤️  Execution Paths: ${args.startFunction} → ${args.endFunction}\n\n`;
    response += `Found ${paths.length} possible path(s):\n\n`;

    paths.forEach((path, i) => {
      const asyncMark = path.isAsync ? ' ⏳ (async)' : '';
      response += `Path ${i + 1} (depth: ${path.depth})${asyncMark}:\n`;
      response += `  ${path.description}\n\n`;
    });

    if (paths.length > 1) {
      response += `💡 Multiple paths exist. Consider:\n`;
      response += `- Which path is most commonly used?\n`;
      response += `- Are all paths intentional?\n`;
      response += `- Could the code be simplified?\n`;
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error tracing execution path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private handleGetCallTree(args: any) {
  if (!this.callGraphAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const depth = Math.min(args.depth || 3, 5);
    const tree = this.callGraphAnalyzer.getCallTree(args.functionName, depth);

    if (!tree) {
      return {
        content: [{
          type: 'text',
          text: `Function "${args.functionName}" not found in workspace.`,
        }],
      };
    }

    const formatTree = (node: any, indent: string = '', isLast: boolean = true): string => {
      const prefix = isLast ? '└── ' : '├── ';
      const asyncMark = node.isAsync ? '⏳ ' : '';
      const recursiveMark = node.isRecursive ? '🔄 ' : '';
      let result = `${indent}${prefix}${asyncMark}${recursiveMark}${node.function} (${node.file}:${node.line})\n`;
      
      if (node.calls && node.calls.length > 0 && !node.isRecursive) {
        const newIndent = indent + (isLast ? '    ' : '│   ');
        node.calls.forEach((child: any, i: number) => {
          result += formatTree(child, newIndent, i === node.calls.length - 1);
        });
      }
      
      return result;
    };

    let response = `🌲 Call Tree (depth: ${depth})\n\n`;
    response += formatTree(tree);
    response += `\n`;
    response += `Legend:\n`;
    response += `⏳ = async function\n`;
    response += `🔄 = recursive call\n`;

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error getting call tree: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

// ========== V0.4.0 HANDLERS - TYPE ANALYSIS ==========

private async handleFindTypeDefinition(args: any) {
  if (!this.typeAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const definition = await this.typeAnalyzer.findTypeDefinition(args.typeName);
    
    if (!definition) {
      return {
        content: [{
          type: 'text',
          text: `Type "${args.typeName}" not found in workspace.\n\nMake sure:\n- The type is defined in a .ts or .tsx file\n- The type name is spelled correctly\n- The file is in the workspace`,
        }],
      };
    }

    const file = this.getRelativePath(definition.filePath);
    let response = `📘 Type Definition: ${definition.name}\n\n`;
    response += `🏷️  Kind: ${definition.kind}\n`;
    response += `📍 Location: ${file}:${definition.line}\n`;
    response += `📤 Exported: ${definition.isExported ? 'Yes' : 'No'}\n\n`;
    response += `Raw definition:\n\`\`\`typescript\n${definition.raw}\n\`\`\``;

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error finding type definition: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private async handleGetTypeInfo(args: any) {
  if (!this.typeAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const info = await this.typeAnalyzer.getTypeInfo(args.typeName);
    
    if (!info) {
      return {
        content: [{
          type: 'text',
          text: `Type "${args.typeName}" not found in workspace.`,
        }],
      };
    }

    const file = this.getRelativePath(info.definition.filePath);
    let response = `📘 Complete Type Information: ${info.definition.name}\n\n`;
    response += `📍 ${file}:${info.definition.line}\n`;
    response += `🏷️  ${info.definition.kind}\n\n`;

    // Type-specific details
    const details = info.details;

    if (details.kind === 'interface') {
      if (details.extends && details.extends.length > 0) {
        response += `🔗 Extends: ${details.extends.join(', ')}\n\n`;
      }

      if (details.properties.length > 0) {
        response += `📦 Properties (${details.properties.length}):\n`;
        details.properties.forEach(prop => {
          const optional = prop.optional ? '?' : '';
          const readonly = prop.readonly ? 'readonly ' : '';
          response += `  • ${readonly}${prop.name}${optional}: ${prop.type}\n`;
        });
        response += `\n`;
      }

      if (details.methods.length > 0) {
        response += `⚙️  Methods (${details.methods.length}):\n`;
        details.methods.forEach(method => {
          const params = method.params.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
          response += `  • ${method.name}(${params}): ${method.returnType || 'void'}\n`;
        });
        response += `\n`;
      }
    } else if (details.kind === 'type') {
      response += `📝 Definition:\n  ${details.definition}\n\n`;
    } else if (details.kind === 'class') {
      if (details.extends) {
        response += `🔗 Extends: ${details.extends}\n`;
      }
      if (details.implements && details.implements.length > 0) {
        response += `🔗 Implements: ${details.implements.join(', ')}\n`;
      }
      response += `\n`;

      if (details.constructor) {
        const params = details.constructor.params.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
        response += `🏗️  Constructor(${params})\n\n`;
      }

      if (details.properties.length > 0) {
        response += `📦 Properties (${details.properties.length}):\n`;
        details.properties.forEach(prop => {
          const optional = prop.optional ? '?' : '';
          const readonly = prop.readonly ? 'readonly ' : '';
          response += `  • ${readonly}${prop.name}${optional}: ${prop.type}\n`;
        });
        response += `\n`;
      }

      if (details.methods.length > 0) {
        response += `⚙️  Methods (${details.methods.length}):\n`;
        details.methods.forEach(method => {
          const vis = method.visibility || 'public';
          const stat = method.isStatic ? 'static ' : '';
          const async = method.isAsync ? 'async ' : '';
          response += `  • ${vis} ${stat}${async}${method.name}()\n`;
        });
        response += `\n`;
      }
    } else if (details.kind === 'enum') {
      response += `📋 Members (${details.members.length}):\n`;
      details.members.forEach(member => {
        const value = member.value !== undefined ? ` = ${member.value}` : '';
        response += `  • ${member.name}${value}\n`;
      });
      response += `\n`;
    }

    // Related types
    if (info.relatedTypes.length > 0) {
      response += `🔗 Related Types: ${info.relatedTypes.join(', ')}\n\n`;
    }

    // Usage count
    response += `📊 Used in ${info.usages.length} location(s)\n`;

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error getting type info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private async handleFindTypeUsages(args: any) {
  if (!this.typeAnalyzer) {
    return {
      content: [{ type: 'text', text: 'No workspace set. Use set_workspace first.' }],
    };
  }

  try {
    const usages = await this.typeAnalyzer.findTypeUsages(args.typeName);
    
    if (usages.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `Type "${args.typeName}" is not used anywhere.\n\nThis type might be:\n- Newly defined\n- Exported but not used\n- Dead code (consider removing)`,
        }],
      };
    }

    let response = `📊 Usage of type "${args.typeName}" (${usages.length} locations):\n\n`;

    // Group by file
    const byFile = new Map<string, typeof usages>();
    usages.forEach(usage => {
      const file = this.getRelativePath(usage.filePath);
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(usage);
    });

    byFile.forEach((fileUsages, file) => {
      response += `📄 ${file} (${fileUsages.length} usages):\n`;
      fileUsages.slice(0, 5).forEach(usage => {
        const icon = usage.usageType === 'variable' ? '📦' :
                     usage.usageType === 'parameter' ? '⚙️' :
                     usage.usageType === 'return' ? '↩️' :
                     usage.usageType === 'generic' ? '<>' :
                     usage.usageType === 'implements' ? '🔗' :
                     usage.usageType === 'extends' ? '🔗' : '•';
        response += `  ${icon} Line ${usage.line}: ${usage.context}\n`;
      });
      if (fileUsages.length > 5) {
        response += `  ... and ${fileUsages.length - 5} more\n`;
      }
      response += `\n`;
    });

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error finding type usages: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }
}

private getRelativePath(filePath: string): string {
  if (!this.dependencyAnalyzer) return filePath;
  return filePath.replace(this.dependencyAnalyzer['workspacePath'], '').replace(/^[\\\/]/, '');
}

    // ========== V0.5.0 HANDLERS - PLATFORM SYNC ==========

    private handleSwitchPlatform(args: { fromPlatform: AIPlatform; toPlatform: AIPlatform }) {
      const handoff = this.platformSync.createHandoff(args.fromPlatform, args.toPlatform);

      if (!handoff) {
        return {
          content: [{
            type: 'text',
            text: 'No active project. Initialize a project first to enable platform handoff.',
          }],
        };
      }

      this.platformSync.setPlatform(args.toPlatform);

      return {
        content: [{
          type: 'text',
          text: handoff.summary,
        }],
      };
    }

   private handleGetPlatformStatus() {
      const status = PlatformSync.getPlatformStatus();
      const current = this.platformSync.getPlatform();

      let response = `📱 Platform Configuration Status\n\n`;
      response += `Current Platform: ${current}\n\n`;
      response += `Configuration Status:\n`;
      response += `  ${status.claude ? '✅' : '❌'} Claude Desktop\n`;
      response += `  ${status.cursor ? '✅' : '❌'} Cursor\n`;
      response += `  ${status.copilot ? '✅' : '❌'} GitHub Copilot\n\n`;

      if (!status.cursor) {
        response += `💡 To configure Cursor, use the setup_cursor tool or manually configure:\n`;
        response += PlatformSync.getInstallInstructions('cursor');
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    private handleGetPlatformContext(args: { platform?: AIPlatform }) {
      const platform = args.platform || this.platformSync.getPlatform();
      const context = this.platformSync.getPlatformContext(platform);

      return {
        content: [{ type: 'text', text: context }],
      };
    }

    private handleSetupCursor() {
      const paths = PlatformSync.getConfigPaths();
      const cursorPath = paths.cursor;
      const instructions = PlatformSync.getInstallInstructions('cursor');

      let response = `🚀 Cursor Setup Instructions\n\n`;
      response += instructions;
      response += `\n\n📄 Configuration File: ${cursorPath}\n\n`;
      response += `⚠️  Note: You'll need to manually edit the configuration file and restart Cursor.`;

      return {
        content: [{ type: 'text', text: response }],
      };
    }

  private async handleGetStarted() {
    // Check installation status - if we're here, Context Sync is working
    const version = this.getVersion();
    
    // Get current state using session-based approach (NEW)
    const currentProject = this.getCurrentProject();
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    const detectedPlatform = PlatformSync.detectPlatform(); // Real-time detection
    const platformStatus = PlatformSync.getPlatformStatus();
    
    // Build response
    let response = `🎉 **Context Sync v${version} is working!**\n\n`;
    
    // Show integrated AI platforms
    response += `🤖 **Integrated AI Platforms:**\n`;
    response += `${platformStatus.claude ? '✅' : '⚪'} **Claude Desktop** - Advanced reasoning and code analysis\n`;
    response += `${platformStatus.cursor ? '✅' : '⚪'} **Cursor IDE** - Real-time coding assistance\n`;
    response += `${platformStatus.copilot ? '✅' : '⚪'} **GitHub Copilot (VS Code)** - Intelligent code completion\n\n`;
    
    // Current status - simplified and useful
    response += `📊 **Current Status:**\n`;
    if (currentProject) {
      response += `• Active Project: ${currentProject.name}\n`;
    }
    if (workspace) {
      response += `• Workspace: Set\n`;
    }
    response += `\n`;
    
    // Next steps based on current state
    response += `🚀 **Quick Start Options:**\n\n`;
    
    if (!currentProject) {
      response += `1️⃣ **Set up your workspace**\n`;
      response += `   → "Set workspace to /path/to/your/project"\n\n`;
    } else {
      response += `1️⃣ **Explore your project**\n`;
      response += `   → "Scan workspace" or "Get project structure"\n\n`;
    }
    
    response += `2️⃣ **Try key features**\n`;
    response += `   → "Show me what Context Sync can do"\n\n`;
    
    // Universal platform guidance
    response += `💡 **Getting Started:**\n\n`;
    
    if (!workspace) {
      response += `🎯 **First, set your workspace:**\n`;
      response += `• Try: "Set workspace to /path/to/your/project"\n`;
      response += `• This enables all Context Sync features\n\n`;
    } else {
      response += `🎯 **Your workspace is ready! Try these:**\n`;
      response += `• "Scan workspace" - Get project overview\n`;
      response += `• "Search content for TODO" - Find todos in code\n`;
      response += `• "Create todo: Fix authentication bug" - Add todos\n`;
      response += `• "Get project structure" - See file organization\n\n`;
    }
    
    // Show what each platform offers
    response += `**All Platforms Support:**\n`;
    response += `• 📁 Project workspace management\n`;
    response += `• 🔍 Code search and analysis\n`;
    response += `• 📋 Todo management with auto-linking\n`;
    response += `• 🔄 Cross-platform context sync\n`;
    response += `• ⚡ Performance monitoring\n`;
    response += `• 🧠 Intelligent file skimming for large codebases\n\n`;
    
    response += `🔧 **Advanced Commands:**\n`;
    response += `• "Setup cursor" - Get Cursor IDE setup instructions\n`;
    response += `• "Check platform status" - Verify platform configurations\n`;
    response += `• "Get performance report" - View system metrics\n`;
    response += `• "Show features" - See all available tools\n\n`;
    
    response += `**Ready to get started?** Choose an option above! 🚀`;
    
    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  private async handleDebugSession() {
    const version = this.getVersion();
    const platform = this.platformSync.getPlatform();
    
    // Session-based current project (NEW)
    const sessionProject = this.getCurrentProject();
    
    // Database-based current project (OLD - should be deprecated)
    const dbProject = this.storage.getCurrentProject();
    
    // Workspace information
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    
    // All projects in database
    const allProjects = this.storage.getAllProjects();
    
    // Build response
    let response = `🔍 **Context Sync Session Debug v${version}**\n\n`;
    
    // Session information
    response += `📱 **Session State:**\n`;
    response += `• Platform: ${platform}\n`;
    response += `• Session Project ID: ${this.currentProjectId || 'null'}\n`;
    response += `• Session Project: ${sessionProject ? sessionProject.name : 'None'}\n\n`;
    
    // Database state
    response += `💾 **Database State:**\n`;
    response += `• DB Current Project: ${dbProject ? dbProject.name : 'None'}\n`;
    response += `• Total Projects: ${allProjects.length}\n`;
    response += `• Workspace Set: ${workspace ? 'Yes' : 'No'}\n`;
    if (workspace) {
      response += `• Workspace Path: ${workspace}\n`;
    }
    response += `\n`;
    
    // Project list
    if (allProjects.length > 0) {
      response += `📂 **All Projects:**\n`;
      allProjects.forEach((project: any, index: number) => {
        const isSession = sessionProject && sessionProject.id === project.id;
        const isDB = dbProject && dbProject.id === project.id;
        const markers = [];
        if (isSession) markers.push('SESSION');
        if (isDB) markers.push('DB');
        const markerText = markers.length > 0 ? ` [${markers.join(', ')}]` : '';
        
        response += `${index + 1}. ${project.name}${markerText}\n`;
        response += `   Path: ${project.path}\n`;
        response += `   ID: ${project.id}\n`;
      });
      response += `\n`;
    }
    
    // Architecture validation
    response += `⚙️ **Architecture Validation:**\n`;
    response += `• Session-based: ${sessionProject ? '✅' : '❌'}\n`;
    response += `• DB deprecated: ${!dbProject || sessionProject ? '✅' : '⚠️'}\n`;
    response += `• Consistency: ${(!sessionProject && !dbProject) || (sessionProject && sessionProject.id === dbProject?.id) ? '✅' : '⚠️ Mismatch'}\n\n`;
    
    // Multi-project testing instructions
    response += `🧪 **Multi-Project Testing:**\n`;
    response += `1. Test different MCP clients with different projects\n`;
    response += `2. Verify each maintains separate session state\n`;
    response += `3. Check todo auto-linking per session\n\n`;
    
    response += `💡 **Usage:** Use this tool to debug session isolation and project state consistency.`;
    
    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  private async handleGetPerformanceReport(args: { operation?: string; reset?: boolean }) {
    const { operation, reset = false } = args;
    
    let response = `📊 **Context Sync Performance Report**\n\n`;
    
    if (operation) {
      // Get stats for specific operation
      const stats = PerformanceMonitor.getStats(operation);
      if (stats.count > 0) {
        response += `🔍 **Operation: ${operation}**\n`;
        response += `• Calls: ${stats.count}\n`;
        response += `• Total Time: ${stats.totalDuration.toFixed(2)}ms\n`;
        response += `• Average Time: ${stats.averageDuration.toFixed(2)}ms\n`;
        response += `• Min Time: ${stats.minDuration.toFixed(2)}ms\n`;
        response += `• Max Time: ${stats.maxDuration.toFixed(2)}ms\n\n`;
      } else {
        response += `❌ No data found for operation: ${operation}\n\n`;
      }
    } else {
      // Get all operation stats
      const allStats = PerformanceMonitor.getAllOperationStats();
      if (Object.keys(allStats).length === 0) {
        response += `ℹ️ No performance data collected yet.\n`;
        response += `Performance monitoring tracks database operations like:\n`;
        response += `• findProjectByPath\n`;
        response += `• createProject\n`;
        response += `• getAllProjects\n\n`;
      } else {
        response += `📈 **All Operations:**\n\n`;
        Object.entries(allStats).forEach(([opName, stats]) => {
          response += `**${opName}:**\n`;
          response += `• Calls: ${stats.count}\n`;
          response += `• Avg Time: ${stats.averageDuration.toFixed(2)}ms\n`;
          response += `• Total Time: ${stats.totalDuration.toFixed(2)}ms\n`;
          response += `• Range: ${stats.minDuration.toFixed(2)}ms - ${stats.maxDuration.toFixed(2)}ms\n\n`;
        });
      }
      
      // Use the formatted report from PerformanceMonitor
      const detailedReport = PerformanceMonitor.getReport();
      response += `📋 **Detailed Report:**\n${detailedReport}\n\n`;
    }
    
    if (reset) {
      PerformanceMonitor.clearMetrics();
      response += `🔄 **Performance data has been reset.**\n\n`;
    }
    
    response += `💡 **Usage:** Monitor database operation performance to identify optimization opportunities.`;
    
    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  // ========== TODO HANDLERS WITH CURRENT PROJECT INTEGRATION ==========

  private async handleTodoCreate(args: any) {
    // Auto-link to current project if no projectId provided
    if (!args.projectId) {
      const currentProject = this.getCurrentProject();
      if (currentProject) {
        args.projectId = currentProject.id;
      }
    }

    const todo = this.todoManager.createTodo(args);
    const projectInfo = args.projectId ? ` (linked to current project)` : '';
    
    return {
      content: [{
        type: 'text',
        text: `✅ Todo created: "${todo.title}"${projectInfo}\n\nID: ${todo.id}\nPriority: ${todo.priority}\nStatus: ${todo.status}${todo.dueDate ? `\nDue: ${todo.dueDate}` : ''}${todo.tags.length > 0 ? `\nTags: ${todo.tags.join(', ')}` : ''}`,
      }],
    };
  }

  private async handleTodoGet(args: { id: string }) {
    const todo = this.todoManager.getTodo(args.id);
    
    if (!todo) {
      return {
        content: [{
          type: 'text',
          text: `❌ Todo not found: ${args.id}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📋 **${todo.title}**\n\nStatus: ${todo.status}\nPriority: ${todo.priority}\n${todo.description ? `Description: ${todo.description}\n` : ''}${todo.dueDate ? `Due: ${todo.dueDate}\n` : ''}${todo.tags.length > 0 ? `Tags: ${todo.tags.join(', ')}\n` : ''}Created: ${todo.createdAt}\nUpdated: ${todo.updatedAt}${todo.completedAt ? `\nCompleted: ${todo.completedAt}` : ''}`,
      }],
    };
  }

  private async handleTodoList(args?: any) {
    // If no projectId specified and there's a current project, filter by current project
    if (!args?.projectId) {
      const currentProject = this.getCurrentProject();
      if (currentProject) {
        args = { ...args, projectId: currentProject.id };
      }
    }

    const todos = this.todoManager.listTodos(args);
    
    if (todos.length === 0) {
      const currentProject = this.getCurrentProject();
      const projectContext = currentProject ? ` for project "${currentProject.name}"` : '';
      return {
        content: [{
          type: 'text',
          text: `📝 No todos found${projectContext}`,
        }],
      };
    }

    const grouped = {
      urgent: todos.filter(t => t.priority === 'urgent' && t.status !== 'completed'),
      high: todos.filter(t => t.priority === 'high' && t.status !== 'completed'),
      medium: todos.filter(t => t.priority === 'medium' && t.status !== 'completed'),
      low: todos.filter(t => t.priority === 'low' && t.status !== 'completed'),
      completed: todos.filter(t => t.status === 'completed')
    };

    const currentProject = this.getCurrentProject();
    const projectContext = currentProject ? ` for project "${currentProject.name}"` : '';
    let output = `📋 Found ${todos.length} todo(s)${projectContext}\n\n`;

    const formatTodo = (todo: any) => {
      const statusEmoji: { [key: string]: string } = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        cancelled: '❌'
      };
      return `${statusEmoji[todo.status] || '📋'} ${todo.title}${todo.dueDate ? ` (Due: ${todo.dueDate})` : ''}\n   ID: ${todo.id}`;
    };

    if (grouped.urgent.length > 0) {
      output += `🔴 **URGENT** (${grouped.urgent.length})\n`;
      grouped.urgent.forEach((todo: any) => output += formatTodo(todo) + '\n');
      output += '\n';
    }

    if (grouped.high.length > 0) {
      output += `🟠 **HIGH** (${grouped.high.length})\n`;
      grouped.high.forEach((todo: any) => output += formatTodo(todo) + '\n');
      output += '\n';
    }

    if (grouped.medium.length > 0) {
      output += `🟡 **MEDIUM** (${grouped.medium.length})\n`;
      grouped.medium.forEach((todo: any) => output += formatTodo(todo) + '\n');
      output += '\n';
    }

    if (grouped.low.length > 0) {
      output += `🟢 **LOW** (${grouped.low.length})\n`;
      grouped.low.forEach((todo: any) => output += formatTodo(todo) + '\n');
      output += '\n';
    }

    if (grouped.completed.length > 0 && !args?.status) {
      output += `✅ **COMPLETED** (${grouped.completed.length})\n`;
      grouped.completed.slice(0, 5).forEach((todo: any) => output += formatTodo(todo) + '\n');
      if (grouped.completed.length > 5) {
        output += `   ... and ${grouped.completed.length - 5} more\n`;
      }
    }

    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
  }

  private async handleTodoUpdate(args: any) {
    const todo = this.todoManager.updateTodo(args);
    
    if (!todo) {
      return {
        content: [{
          type: 'text',
          text: `❌ Todo not found: ${args.id}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Todo updated: "${todo.title}"\n\nStatus: ${todo.status}\nPriority: ${todo.priority}\nUpdated: ${todo.updatedAt}`,
      }],
    };
  }

  private async handleTodoDelete(args: { id: string }) {
    const success = this.todoManager.deleteTodo(args.id);
    
    if (!success) {
      return {
        content: [{
          type: 'text',
          text: `❌ Todo not found: ${args.id}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Todo deleted: ${args.id}`,
      }],
    };
  }

  private async handleTodoComplete(args: { id: string }) {
    const todo = this.todoManager.completeTodo(args.id);
    
    if (!todo) {
      return {
        content: [{
          type: 'text',
          text: `❌ Todo not found: ${args.id}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Todo completed: "${todo.title}"\n\nCompleted at: ${todo.completedAt}`,
      }],
    };
  }

  private async handleTodoStats(args?: { projectId?: string }) {
    // Use current project if no projectId specified
    let projectId = args?.projectId;
    if (!projectId) {
      const currentProject = this.getCurrentProject();
      if (currentProject) {
        projectId = currentProject.id;
      }
    }

    const stats = this.todoManager.getStats(projectId);
    const currentProject = this.getCurrentProject();
    const projectContext = projectId && currentProject ? ` for project "${currentProject.name}"` : '';
    
    let output = `📊 Todo Statistics${projectContext}\n\n`;
    output += `**Total:** ${stats.total} todos\n\n`;
    
    output += `**By Status:**\n`;
    output += `⏳ Pending: ${stats.byStatus.pending}\n`;
    output += `🔄 In Progress: ${stats.byStatus.in_progress}\n`;
    output += `✅ Completed: ${stats.byStatus.completed}\n`;
    output += `❌ Cancelled: ${stats.byStatus.cancelled}\n\n`;
    
    output += `**By Priority:**\n`;
    output += `🔴 Urgent: ${stats.byPriority.urgent}\n`;
    output += `🟠 High: ${stats.byPriority.high}\n`;
    output += `🟡 Medium: ${stats.byPriority.medium}\n`;
    output += `🟢 Low: ${stats.byPriority.low}\n\n`;
    
    if (stats.overdue > 0) {
      output += `⚠️  **${stats.overdue} overdue** todo(s)\n`;
    }
    
    if (stats.dueSoon > 0) {
      output += `⏰ **${stats.dueSoon} due soon** (within 24 hours)\n`;
    }

    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
  }

  private async handleTodoTags() {
    const tags = this.todoManager.getAllTags();
    
    if (tags.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '🏷️  No tags found',
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `🏷️  Available tags (${tags.length}):\n\n${tags.join(', ')}`,
      }],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Context Sync MCP server v0.5.2 running on stdio');
  }

  close(): void {
    this.storage.close();
  }
}