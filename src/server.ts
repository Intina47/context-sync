import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Storage } from './storage.js';

export class ContextSyncServer {
  private server: Server;
  private storage: Storage;

  constructor(storagePath?: string) {
    this.storage = new Storage(storagePath);
    
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
    prompt += `• Don't explicitly say "I loaded context" or "based on the context" - just naturally use the information`;

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