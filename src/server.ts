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

export class ContextSyncServer {
  private server: Server;
  private storage: Storage;
  private projectDetector: ProjectDetector;
  private workspaceDetector: WorkspaceDetector; 

  constructor(storagePath?: string) {
    this.storage = new Storage(storagePath);
    this.projectDetector = new ProjectDetector(this.storage);
    this.workspaceDetector = new WorkspaceDetector(this.storage, this.projectDetector);

    this.server = new Server(
      {
        name: 'context-sync',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {}, // NEW: Enable prompts
        },
      }
    );

    this.setupToolHandlers();
    this.setupPromptHandlers(); // NEW: Setup prompts
  }

  private setupPromptHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'project_context',
          description: 'Automatically inject active project context into conversation',
          arguments: [],
        },
      ],
    }));

    // Provide prompt content
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (request.params.name !== 'project_context') {
        throw new Error(`Unknown prompt: ${request.params.name}`);
      }

      const project = this.storage.getCurrentProject();

      if (!project) {
        // No project - return empty
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
    const { project, recentDecisions, recentConversations } = summary;

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

    if (recentConversations.length > 0) {
      prompt += `\n💬 Recent Activity:\n`;
      recentConversations.slice(0, 3).forEach((c: any) => {
        const date = new Date(c.timestamp).toLocaleDateString();
        const preview = c.content.substring(0, 80);
        prompt += `• ${date}: ${preview}...\n`;
      });
    }

    const lastUpdated = new Date(project.updatedAt).toLocaleString();
    prompt += `\n🕐 Last Updated: ${lastUpdated}\n`;

    prompt += `\n---\n`;
    prompt += `IMPORTANT CONTEXT INSTRUCTIONS:\n`;
    prompt += `• You are currently working on the "${project.name}" project\n`;
    prompt += `• When the user asks about "the project", "the app", "auth", "database", or any technical topic, `;
    prompt += `assume they're referring to ${project.name} unless they explicitly mention a different project\n`;
    prompt += `• Use the decisions and tech stack above to inform your responses\n`;
    prompt += `• If you're not sure if they're asking about ${project.name}, call get_project_context to check\n`;
    prompt += `• Don't explicitly say "I loaded context" or "based on the context" - just naturally use the information\n\n`;
    
    prompt += `AVAILABLE WORKSPACE TOOLS:\n`;
    prompt += `• set_workspace(path) - Open a project folder and read its files\n`;
    prompt += `• scan_workspace() - Get overview of all files in workspace\n`;
    prompt += `• read_file(path) - Read any file from the workspace\n`;
    prompt += `• get_project_structure() - See file/folder tree\n\n`;
    
    prompt += `When user says "scan workspace", "read file X", "show me the code", or asks about specific files, USE THESE TOOLS!`;

    return prompt;
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_project_context',
          description: 'Get the current project context including recent decisions and conversations',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'save_decision',
          description: 'Save an important technical decision or architectural choice',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['architecture', 'library', 'pattern', 'configuration', 'other'],
                description: 'Type of decision',
              },
              description: {
                type: 'string',
                description: 'What was decided',
              },
              reasoning: {
                type: 'string',
                description: 'Why this decision was made (optional)',
              },
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
              content: {
                type: 'string',
                description: 'The conversation content to save',
              },
              role: {
                type: 'string',
                enum: ['user', 'assistant'],
                description: 'Who said this',
              },
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
              name: {
                type: 'string',
                description: 'Project name',
              },
              path: {
                type: 'string',
                description: 'Project path (optional)',
              },
              architecture: {
                type: 'string',
                description: 'Project architecture (e.g., "React + TypeScript + Next.js")',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'detect_project',
          description: 'Auto-detect project from a directory path',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to project directory',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'set_workspace',
          description: 'Set the current workspace/project folder (like opening in IDE)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to workspace directory',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'read_file',
          description: 'Read a file from the current workspace',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Relative path to file within workspace (e.g. "src/app/page.tsx")',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'get_project_structure',
          description: 'Get the file/folder structure of current workspace',
          inputSchema: {
            type: 'object',
            properties: {
              depth: {
                type: 'number',
                description: 'Maximum depth to traverse (default: 3)',
              },
            },
          },
        },
        {
          name: 'scan_workspace',
          description: 'Scan workspace and get overview of important files',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_project_context': {
          return this.handleGetContext();
        }

        case 'save_decision': {
          return this.handleSaveDecision(args as any);
        }

        case 'save_conversation': {
          return this.handleSaveConversation(args as any);
        }

        case 'init_project': {
          return this.handleInitProject(args as any);
        }

        case 'detect_project': {
          return this.handleDetectProject(args as any);
        }

        case 'set_workspace': {
          return this.handleSetWorkspace(args as any);
        }

        case 'read_file': {
          return this.handleReadFile(args as any);
        }

        case 'get_project_structure': {
          return this.handleGetProjectStructure(args as any);
        }

        case 'scan_workspace': {
          return this.handleScanWorkspace();
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private handleGetContext() {
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active project. Use init_project to create one.',
          },
        ],
      };
    }

    const summary = this.storage.getContextSummary(project.id);

    const contextText = this.formatContextSummary(summary);

    return {
      content: [
        {
          type: 'text',
          text: contextText,
        },
      ],
    };
  }

  private handleSaveDecision(args: {
    type: string;
    description: string;
    reasoning?: string;
  }) {
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active project. Use init_project first.',
          },
        ],
      };
    }

    const decision = this.storage.addDecision({
      projectId: project.id,
      type: args.type as any,
      description: args.description,
      reasoning: args.reasoning,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Decision saved: ${decision.description}`,
        },
      ],
    };
  }

  private handleSaveConversation(args: {
    content: string;
    role: 'user' | 'assistant';
  }) {
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active project. Use init_project first.',
          },
        ],
      };
    }

    this.storage.addConversation({
      projectId: project.id,
      tool: 'claude', // We can detect this later
      role: args.role,
      content: args.content,
    });

    return {
      content: [
        {
          type: 'text',
          text: 'Conversation saved to project context.',
        },
      ],
    };
  }

  private handleInitProject(args: {
    name: string;
    path?: string;
    architecture?: string;
  }) {
    const project = this.storage.createProject(args.name, args.path);

    if (args.architecture) {
      this.storage.updateProject(project.id, {
        architecture: args.architecture,
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: `Project "${args.name}" initialized and set as active.`,
        },
      ],
    };
  }

  private handleDetectProject(args: { path: string }) {
    try {
      this.projectDetector.createOrUpdateProject(args.path);
      
      const project = this.storage.getCurrentProject();
      
      if (!project) {
        return {
          content: [
            {
              type: 'text',
              text: `No project detected at: ${args.path}`,
            },
          ],
        };
      }

      const techStack = project.techStack.join(', ') || 'None detected';
      const arch = project.architecture || 'Not specified';

      return {
        content: [
          {
            type: 'text',
            text: `📁 Detected project: ${project.name}\n🏗️  Architecture: ${arch}\n⚙️  Tech Stack: ${techStack}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error detecting project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private handleSetWorkspace(args: { path: string }) {
    try {
      // Set workspace (this also auto-detects project)
      this.workspaceDetector.setWorkspace(args.path);
      
      // Get the detected project
      const project = this.storage.getCurrentProject();
      
      if (!project) {
        return {
          content: [
            {
              type: 'text',
              text: `Workspace set to: ${args.path}\nBut no project configuration detected.`,
            },
          ],
        };
      }

      // Get structure preview
      const structure = this.workspaceDetector.getProjectStructure(2);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Workspace set: ${args.path}\n\n📁 Project: ${project.name}\n⚙️  Tech Stack: ${project.techStack.join(', ')}\n\n📂 Structure Preview:\n${structure}\n\nYou can now:\n- read_file to view any file\n- get_project_structure for full tree\n- scan_workspace for overview`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error setting workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private handleReadFile(args: { path: string }) {
    try {
      const file = this.workspaceDetector.readFile(args.path);
      
      if (!file) {
        return {
          content: [
            {
              type: 'text',
              text: `File not found: ${args.path}\n\nMake sure:\n1. Workspace is set (use set_workspace)\n2. Path is relative to workspace root\n3. File exists`,
            },
          ],
        };
      }

      // For large files, warn about size
      const sizeKB = file.size / 1024;
      let sizeWarning = '';
      if (sizeKB > 100) {
        sizeWarning = `\n⚠️  Large file (${sizeKB.toFixed(1)}KB) - showing full content\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `📄 ${file.path} (${file.language})${sizeWarning}\n\`\`\`${file.language.toLowerCase()}\n${file.content}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private handleGetProjectStructure(args: { depth?: number }) {
    try {
      const depth = args.depth || 3;
      const structure = this.workspaceDetector.getProjectStructure(depth);

      if (!structure || structure === 'No workspace open') {
        return {
          content: [
            {
              type: 'text',
              text: 'No workspace set. Use set_workspace first.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `📂 Project Structure (depth: ${depth}):\n\n${structure}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private handleScanWorkspace() {
    try {
      const snapshot = this.workspaceDetector.createSnapshot();

      if (!snapshot.rootPath) {
        return {
          content: [
            {
              type: 'text',
              text: 'No workspace set. Use set_workspace first.',
            },
          ],
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
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scanning workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
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
    
    console.error('Context Sync MCP server running on stdio');
  }

  close(): void {
    this.storage.close();
  }
}