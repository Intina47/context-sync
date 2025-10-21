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

export class ContextSyncServer {
  private server: Server;
  private storage: Storage;
  private projectDetector: ProjectDetector;
  private workspaceDetector: WorkspaceDetector;
  private fileWriter: FileWriter;
  private fileSearcher: FileSearcher;
  private gitIntegration: GitIntegration | null = null;

  constructor(storagePath?: string) {
    this.storage = new Storage(storagePath);
    this.projectDetector = new ProjectDetector(this.storage);
    this.workspaceDetector = new WorkspaceDetector(this.storage, this.projectDetector);
    this.fileWriter = new FileWriter(this.workspaceDetector, this.storage);
    this.fileSearcher = new FileSearcher(this.workspaceDetector);

    this.server = new Server(
      {
        name: 'context-sync',
        version: '0.3.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupPromptHandlers();
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

      const project = this.storage.getCurrentProject();

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
      if (name === 'init_project') return this.handleInitProject(args as any);
      if (name === 'detect_project') return this.handleDetectProject(args as any);
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
        name: 'init_project',
        description: 'Initialize or switch to a project',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            architecture: { type: 'string' },
          },
          required: ['name'],
        },
      },
      {
        name: 'detect_project',
        description: 'Auto-detect project from a directory path',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
      {
        name: 'set_workspace',
        description: 'Set the current workspace/project folder',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
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
                  line: { type: 'number' },
                  oldText: { type: 'string' },
                  newText: { type: 'string' },
                },
              },
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
            changes: { type: 'array' },
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
    ];
  }

  // ========== V0.2.0 HANDLERS ==========

  private handleGetContext() {
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return {
        content: [{
          type: 'text',
          text: 'No active project. Use init_project to create one.',
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
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return {
        content: [{ type: 'text', text: 'No active project. Use init_project first.' }],
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
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return {
        content: [{ type: 'text', text: 'No active project. Use init_project first.' }],
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

  private handleInitProject(args: any) {
    const project = this.storage.createProject(args.name, args.path);

    if (args.architecture) {
      this.storage.updateProject(project.id, { architecture: args.architecture });
    }

    return {
      content: [{ type: 'text', text: `Project "${args.name}" initialized and set as active.` }],
    };
  }

  private handleDetectProject(args: any) {
    try {
      this.projectDetector.createOrUpdateProject(args.path);
      const project = this.storage.getCurrentProject();
      
      if (!project) {
        return {
          content: [{ type: 'text', text: `No project detected at: ${args.path}` }],
        };
      }

      const techStack = project.techStack.join(', ') || 'None detected';
      const arch = project.architecture || 'Not specified';

      return {
        content: [{
          type: 'text',
          text: `📁 Detected project: ${project.name}\n🏗️  Architecture: ${arch}\n⚙️  Tech Stack: ${techStack}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error detecting project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }

  private handleSetWorkspace(args: any) {
    try {
      this.workspaceDetector.setWorkspace(args.path);
      this.gitIntegration = new GitIntegration(args.path);
      
      const project = this.storage.getCurrentProject();
      
      if (!project) {
        return {
          content: [{
            type: 'text',
            text: `Workspace set to: ${args.path}\nBut no project configuration detected.`,
          }],
        };
      }

      const structure = this.workspaceDetector.getProjectStructure(2);
      const isGit = this.gitIntegration.isGitRepo() ? ' (Git repo ✓)' : '';

      return {
        content: [{
          type: 'text',
          text: `✅ Workspace set: ${args.path}${isGit}\n\n📁 Project: ${project.name}\n⚙️  Tech Stack: ${project.techStack.join(', ')}\n\n📂 Structure Preview:\n${structure}\n\nYou can now:\n- read_file to view files\n- create_file to preview new files (then apply_create_file to create)\n- modify_file to preview changes (then apply_modify_file to apply)\n- search_files to find files\n- git_status to check git status`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error setting workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }

  private handleReadFile(args: any) {
    try {
      const file = this.workspaceDetector.readFile(args.path);
      
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

  private handleGetProjectStructure(args: any) {
    try {
      const depth = args.depth || 3;
      const structure = this.workspaceDetector.getProjectStructure(depth);

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

  private handleScanWorkspace() {
    try {
      const snapshot = this.workspaceDetector.createSnapshot();

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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Context Sync MCP server v0.3.0 running on stdio');
  }

  close(): void {
    this.storage.close();
  }
}