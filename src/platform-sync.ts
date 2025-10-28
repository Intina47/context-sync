import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Storage } from './storage.js';
import type { ProjectContext } from './types.js';

export type AIPlatform = 'claude' | 'cursor' | 'copilot' | 'other';

export interface PlatformSession {
  platform: AIPlatform;
  projectId: string;
  startedAt: Date;
  lastActivityAt: Date;
}

export interface HandoffContext {
  fromPlatform: AIPlatform;
  toPlatform: AIPlatform;
  project: ProjectContext;
  summary: string;
  conversationCount: number;
  decisionCount: number;
  timestamp: Date;
}

/**
 * Manages cross-platform context synchronization
 * Enables seamless handoff between Claude Desktop, Cursor, and other AI platforms
 */
export class PlatformSync {
  private storage: Storage;
  private currentPlatform: AIPlatform = 'claude'; // Default to Claude
  private sessionStartTime: Date;

  constructor(storage: Storage) {
    this.storage = storage;
    this.sessionStartTime = new Date();
  }

  /**
   * Set the current AI platform
   */
  setPlatform(platform: AIPlatform): void {
    this.currentPlatform = platform;
  }

  /**
   * Get the current AI platform
   */
  getPlatform(): AIPlatform {
    return this.currentPlatform;
  }

  /**
   * Create a handoff context when switching platforms
   */
  createHandoff(fromPlatform: AIPlatform, toPlatform: AIPlatform): HandoffContext | null {
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return null;
    }

    const contextSummary = this.storage.getContextSummary(project.id);
    const recentConversations = this.storage.getRecentConversations(project.id, 10);
    
    // Filter conversations by platform
    const fromPlatformConvs = recentConversations.filter(c => c.tool === fromPlatform);
    
    // Build summary
    let summary = `📱 Platform Handoff: ${fromPlatform} → ${toPlatform}\n\n`;
    summary += `📁 Project: ${project.name}\n`;
    
    if (project.architecture) {
      summary += `🏗️  Architecture: ${project.architecture}\n`;
    }
    
    if (project.techStack.length > 0) {
      summary += `⚙️  Tech Stack: ${project.techStack.join(', ')}\n`;
    }
    
    summary += `\n`;
    
    if (contextSummary.recentDecisions.length > 0) {
      summary += `📋 Recent Decisions (${contextSummary.recentDecisions.length}):\n`;
      contextSummary.recentDecisions.slice(0, 3).forEach((d, i) => {
        summary += `${i + 1}. [${d.type}] ${d.description}\n`;
      });
      summary += `\n`;
    }
    
    if (fromPlatformConvs.length > 0) {
      summary += `💬 Last conversation on ${fromPlatform}:\n`;
      const lastConv = fromPlatformConvs[fromPlatformConvs.length - 1];
      summary += `"${lastConv.content.substring(0, 200)}${lastConv.content.length > 200 ? '...' : ''}"\n`;
    }
    
    summary += `\n✅ Context synced and ready on ${toPlatform}!`;

    const handoff: HandoffContext = {
      fromPlatform,
      toPlatform,
      project,
      summary,
      conversationCount: fromPlatformConvs.length,
      decisionCount: contextSummary.recentDecisions.length,
      timestamp: new Date(),
    };

    // Log the handoff as a conversation
    this.storage.addConversation({
      projectId: project.id,
      tool: toPlatform,
      role: 'assistant',
      content: `[Platform Handoff] Switched from ${fromPlatform} to ${toPlatform}. ${fromPlatformConvs.length} conversations and ${contextSummary.recentDecisions.length} decisions synced.`,
      metadata: { handoff: true, fromPlatform, toPlatform },
    });

    return handoff;
  }

  /**
   * Get platform-specific context
   */
  getPlatformContext(platform: AIPlatform): string {
    const project = this.storage.getCurrentProject();
    
    if (!project) {
      return `No active project. Initialize a project to start syncing context across platforms.`;
    }

    const contextSummary = this.storage.getContextSummary(project.id);
    const recentConversations = this.storage.getRecentConversations(project.id, 20);
    
    // Filter by platform
    const platformConvs = recentConversations.filter(c => c.tool === platform);
    const otherConvs = recentConversations.filter(c => c.tool !== platform);
    const otherPlatforms = [...new Set(otherConvs.map(c => c.tool))];
    
    let context = `📱 Current Platform: ${platform}\n\n`;
    context += `📁 Project: ${project.name}\n`;
    
    if (project.architecture) {
      context += `🏗️  Architecture: ${project.architecture}\n`;
    }
    
    if (project.techStack.length > 0) {
      context += `⚙️  Tech Stack: ${project.techStack.join(', ')}\n`;
    }
    
    context += `\n`;
    
    // Recent decisions (shared across all platforms)
    if (contextSummary.recentDecisions.length > 0) {
      context += `📋 Recent Decisions (shared across all platforms):\n`;
      contextSummary.recentDecisions.slice(0, 5).forEach((d, i) => {
        context += `${i + 1}. [${d.type}] ${d.description}\n`;
        if (d.reasoning) {
          context += `   Reasoning: ${d.reasoning}\n`;
        }
      });
      context += `\n`;
    }
    
    // Platform-specific conversations
    if (platformConvs.length > 0) {
      context += `💬 Your conversations on ${platform} (${platformConvs.length} total):\n`;
      platformConvs.slice(-3).forEach((conv, i) => {
        const snippet = conv.content.substring(0, 100);
        const time = new Date(conv.timestamp).toLocaleString();
        context += `${i + 1}. [${time}] ${conv.role}: ${snippet}...\n`;
      });
      context += `\n`;
    }
    
    // Cross-platform activity
    if (otherPlatforms.length > 0) {
      context += `🔄 Activity on other platforms:\n`;
      otherPlatforms.forEach(otherPlatform => {
        const count = otherConvs.filter(c => c.tool === otherPlatform).length;
        context += `  • ${otherPlatform}: ${count} conversations\n`;
      });
      context += `\n💡 All context is automatically synced!\n`;
    }
    
    return context;
  }

  /**
   * Detect which platform is being used based on environment
   * This is a heuristic - not 100% accurate
   */
  static detectPlatform(): AIPlatform {
    // Check for Cursor-specific environment variables
    if (process.env.CURSOR_IDE || process.env.CURSOR_VERSION) {
      return 'cursor';
    }
    
    // Check for GitHub Copilot
    if (process.env.GITHUB_COPILOT_TOKEN) {
      return 'copilot';
    }
    
    // Default to Claude
    return 'claude';
  }

  /**
   * Get configuration paths for different platforms
   */
  static getConfigPaths(): Record<string, string> {
    const homeDir = os.homedir();
    const platform = os.platform();

    const paths: Record<string, string> = {};

    // Claude Desktop config
    if (platform === 'win32') {
      paths.claude = path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    } else if (platform === 'darwin') {
      paths.claude = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
      paths.claude = path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
    }

    // Cursor config
    paths.cursor = path.join(homeDir, '.cursor', 'mcp.json');

    // GitHub Copilot / VS Code config
    if (platform === 'win32') {
      paths.copilot = path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
    } else if (platform === 'darwin') {
      paths.copilot = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    } else {
      paths.copilot = path.join(homeDir, '.config', 'Code', 'User', 'settings.json');
    }

    return paths;
  }

  /**
   * Check if Context Sync is configured for a platform
   */
  static isConfigured(platform: AIPlatform): boolean {
    const paths = PlatformSync.getConfigPaths();
    const configPath = paths[platform];
    
    if (!configPath || !fs.existsSync(configPath)) {
      return false;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      if (platform === 'claude') {
        return config.mcpServers && config.mcpServers['context-sync'] !== undefined;
      } else if (platform === 'cursor') {
        return config.mcpServers && config.mcpServers['context-sync'] !== undefined;
      } else if (platform === 'copilot') {
        // Check if VS Code has Context Sync MCP extension configured
        // This checks for MCP settings in VS Code (requires MCP extension for VS Code/Copilot)
        return (
          config['mcp.servers'] &&
          config['mcp.servers']['context-sync'] !== undefined
        );
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get status of all platform configurations
   */
  static getPlatformStatus(): Record<AIPlatform, boolean> {
    return {
      claude: PlatformSync.isConfigured('claude'),
      cursor: PlatformSync.isConfigured('cursor'),
      copilot: PlatformSync.isConfigured('copilot'),
      other: false,
    };
  }

  /**
   * Generate installation instructions for a platform
   */
  static getInstallInstructions(platform: AIPlatform): string {
    const paths = PlatformSync.getConfigPaths();
    const configPath = paths[platform];

    let instructions = `# Install Context Sync for ${platform}\n\n`;

    if (platform === 'claude') {
      instructions += `1. Open: ${configPath}\n`;
      instructions += `2. Add this to the "mcpServers" section:\n\n`;
      instructions += `"context-sync": {\n`;
      instructions += `  "command": "npx",\n`;
      instructions += `  "args": ["-y", "@context-sync/server"]\n`;
      instructions += `}\n\n`;
      instructions += `3. Restart Claude Desktop\n`;
    } else if (platform === 'cursor') {
      instructions += `1. Open: ${configPath}\n`;
      instructions += `   Or go to: Cursor → Settings → MCP\n\n`;
      instructions += `2. Add this to the "mcpServers" section:\n\n`;
      instructions += `"context-sync": {\n`;
      instructions += `  "command": "npx",\n`;
      instructions += `  "args": ["-y", "@context-sync/server"]\n`;
      instructions += `}\n\n`;
      instructions += `3. Refresh MCP servers in Cursor settings\n`;
    } else if (platform === 'copilot') {
      instructions += `1. Install the Context Sync VS Code extension\n`;
      instructions += `2. Install MCP extension for VS Code (if not already installed)\n`;
      instructions += `3. Open VS Code settings: ${configPath}\n`;
      instructions += `4. Add this to your settings.json:\n\n`;
      instructions += `"mcp.servers": {\n`;
      instructions += `  "context-sync": {\n`;
      instructions += `    "command": "npx",\n`;
      instructions += `    "args": ["-y", "@context-sync/server"]\n`;
      instructions += `  }\n`;
      instructions += `}\n\n`;
      instructions += `5. Reload VS Code window\n`;
      instructions += `\nNote: Context Sync for Copilot works through the VS Code extension.\n`;
    }

    return instructions;
  }
}
