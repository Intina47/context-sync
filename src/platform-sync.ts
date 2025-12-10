import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Storage } from './storage.js';
import type { ProjectContext } from './types.js';

export type AIPlatform = 
  | 'claude'          // Claude Desktop
  | 'cursor'          // Cursor IDE  
  | 'copilot'         // GitHub Copilot (VS Code)
  | 'continue'        // Continue.dev VS Code extension
  | 'tabnine'         // TabNine
  | 'windsurf'        // Windsurf
  | 'zed'             // Zed Editor
  | 'notion'          // Notion (documentation/knowledge management)
  | 'other';

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
   * This is a heuristic - not 100% accurate but covers most common cases
   */
  static detectPlatform(): AIPlatform {
    // Check environment variables and process info
    const processTitle = process.title?.toLowerCase() || '';
    const processArgv = process.argv.join(' ').toLowerCase();
    
    // Cursor IDE detection
    if (process.env.CURSOR_IDE || 
        process.env.CURSOR_VERSION || 
        processTitle.includes('cursor') ||
        processArgv.includes('cursor')) {
      return 'cursor';
    }
    
    // Zed Editor detection
    if (process.env.ZED_EDITOR || 
        processTitle.includes('zed') ||
        processArgv.includes('zed')) {
      return 'zed';
    }
    
    // VS Code with various extensions
    if (process.env.VSCODE_PID || 
        process.env.VSCODE_CWD ||
        processTitle.includes('code') ||
        processArgv.includes('code')) {
      
      // Continue.dev extension
      if (process.env.CONTINUE_GLOBAL_DIR || 
          processArgv.includes('continue')) {
        return 'continue';
      }
      
      // GitHub Copilot
      if (process.env.GITHUB_COPILOT_TOKEN ||
          process.env.GITHUB_TOKEN) {
        return 'copilot';  
      }
      
      // Codeium now integrated into Windsurf - check for Windsurf instead
      // (Legacy Codeium detection moved to Windsurf detection above)
      
      // TabNine
      if (processArgv.includes('tabnine')) {
        return 'tabnine';
      }
    }
    
    // Windsurf by Codeium
    if (process.env.WINDSURF_IDE ||
        processTitle.includes('windsurf') ||
        processArgv.includes('windsurf')) {
      return 'windsurf';
    }

    // Default to Claude Desktop if no specific detection
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

    // VS Code config (used by multiple extensions)
    if (platform === 'win32') {
      paths.vscode = path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
      paths.copilot = paths.vscode; // GitHub Copilot uses VS Code settings
    } else if (platform === 'darwin') {
      paths.vscode = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
      paths.copilot = paths.vscode;
    } else {
      paths.vscode = path.join(homeDir, '.config', 'Code', 'User', 'settings.json');
      paths.copilot = paths.vscode;
    }

    // Continue.dev config (YAML format)
    if (platform === 'win32') {
      paths.continue = path.join(homeDir, '.continue', 'config.yaml');
    } else if (platform === 'darwin') {
      paths.continue = path.join(homeDir, '.continue', 'config.yaml');
    } else {
      paths.continue = path.join(homeDir, '.continue', 'config.yaml');
    }
    
    // Zed config
    if (platform === 'win32') {
      paths.zed = path.join(homeDir, 'AppData', 'Roaming', 'Zed', 'settings.json');
    } else if (platform === 'darwin') {
      paths.zed = path.join(homeDir, 'Library', 'Application Support', 'Zed', 'settings.json');
    } else {
      paths.zed = path.join(homeDir, '.config', 'zed', 'settings.json');
    }
    
    // Windsurf config (similar to Cursor)
    paths.windsurf = path.join(homeDir, '.windsurf', 'mcp.json');
    
    // TabNine native MCP support
    paths.tabnine = path.join(homeDir, '.tabnine', 'mcp_servers.json');

    return paths;
  }

  /**
   * Check if Context Sync is configured for a platform
   */
  static isConfigured(platform: AIPlatform): boolean {
    const paths = PlatformSync.getConfigPaths();
    
    try {
      switch (platform) {
        case 'claude':
          if (!fs.existsSync(paths.claude)) return false;
          const claudeConfig = JSON.parse(fs.readFileSync(paths.claude, 'utf-8'));
          return !!(claudeConfig.mcpServers?.['context-sync']);
          
        case 'cursor':
          if (!fs.existsSync(paths.cursor)) return false;
          const cursorConfig = JSON.parse(fs.readFileSync(paths.cursor, 'utf-8'));
          return !!(cursorConfig.mcpServers?.['context-sync']);
          
        case 'copilot':
          // GitHub Copilot uses VS Code MCP extension
          if (!fs.existsSync(paths.vscode)) return false;
          const vscodeConfig = JSON.parse(fs.readFileSync(paths.vscode, 'utf-8'));
          return !!(vscodeConfig['mcp.servers']?.['context-sync']);
          
        case 'tabnine':
          // TabNine uses native MCP support via .tabnine/mcp_servers.json
          if (!fs.existsSync(paths.tabnine)) return false;
          const tabnineConfig = JSON.parse(fs.readFileSync(paths.tabnine, 'utf-8'));
          return !!(tabnineConfig.mcpServers?.['context-sync']);
          
        case 'continue':
          // Check global config first
          if (fs.existsSync(paths.continue)) {
            try {
              const yaml = require('js-yaml');
              const continueConfig = yaml.load(fs.readFileSync(paths.continue, 'utf-8')) || {};
              const mcpServers = Array.isArray(continueConfig.mcpServers) ? continueConfig.mcpServers : [];
              // Check if Context Sync is in the array
              const found = mcpServers.some((s: any) => {
                if (!s) return false;
                if (s.name && typeof s.name === 'string' && s.name.toLowerCase().includes('context')) return true;
                if (s.command && typeof s.command === 'string' && (s.command.includes('context-sync') || 
                    (Array.isArray(s.args) && s.args.some((arg: any) => typeof arg === 'string' && arg.includes('context-sync'))))) {
                  return true;
                }
                return false;
              });
              if (found) return true;
            } catch {
              // Continue to workspace check if global config fails
            }
          }
          
          // Check workspace config (.continue/mcpServers/context-sync.yaml)
          const workspaceContinueDir = path.join(process.cwd(), '.continue', 'mcpServers');
          if (fs.existsSync(workspaceContinueDir)) {
            const contextSyncYaml = path.join(workspaceContinueDir, 'context-sync.yaml');
            if (fs.existsSync(contextSyncYaml)) {
              try {
                const content = fs.readFileSync(contextSyncYaml, 'utf-8');
                if (content.includes('Context Sync') || content.includes('context-sync') || content.includes('@context-sync/server')) {
                  return true;
                }
              } catch {
                // Ignore errors
              }
            }
          }
          return false;
          
        case 'zed':
          if (!fs.existsSync(paths.zed)) return false;
          const zedConfig = JSON.parse(fs.readFileSync(paths.zed, 'utf-8'));
          return !!(zedConfig.mcpServers?.['context-sync']);
          
        case 'windsurf':
          if (!fs.existsSync(paths.windsurf)) return false;
          const windsurfConfig = JSON.parse(fs.readFileSync(paths.windsurf, 'utf-8'));
          return !!(windsurfConfig.mcpServers?.['context-sync']);
          
        default:
          return false;
      }
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
      continue: PlatformSync.isConfigured('continue'),
      tabnine: PlatformSync.isConfigured('tabnine'),
      windsurf: PlatformSync.isConfigured('windsurf'),
      zed: PlatformSync.isConfigured('zed'),
      notion: PlatformSync.isConfigured('notion'),
      other: false,
    };
  }

  /**
   * Generate installation instructions for a platform
   */
  static getInstallInstructions(platform: AIPlatform): string {
    const paths = PlatformSync.getConfigPaths();

    let instructions = `# Install Context Sync for ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n\n`;

    switch (platform) {
      case 'claude':
        instructions += `1. Open: ${paths.claude}\n`;
        instructions += `2. Add this to the "mcpServers" section:\n\n`;
        instructions += `"context-sync": {\n`;
        instructions += `  "command": "npx",\n`;
        instructions += `  "args": ["-y", "@context-sync/server"]\n`;
        instructions += `}\n\n`;
        instructions += `3. Restart Claude Desktop\n`;
        break;

      case 'cursor':
        instructions += `1. Open: ${paths.cursor}\n`;
        instructions += `   Or go to: Cursor → Settings → MCP\n\n`;
        instructions += `2. Add this to the "mcpServers" section:\n\n`;
        instructions += `"context-sync": {\n`;
        instructions += `  "command": "npx",\n`;
        instructions += `  "args": ["-y", "@context-sync/server"]\n`;
        instructions += `}\n\n`;
        instructions += `3. Refresh MCP servers in Cursor settings\n`;
        break;

      case 'copilot':
        instructions += `1. Install MCP extension for VS Code\n`;
        instructions += `2. Open VS Code settings: ${paths.vscode}\n`;
        instructions += `3. Add this to your settings.json:\n\n`;
        instructions += `"mcp.servers": {\n`;
        instructions += `  "context-sync": {\n`;
        instructions += `    "command": "npx",\n`;
        instructions += `    "args": ["-y", "@context-sync/server"]\n`;
        instructions += `  }\n`;
        instructions += `}\n\n`;
        instructions += `4. Reload VS Code window\n`;
        instructions += `5. Open Copilot Chat and look for Context Sync in available tools\n`;
        break;

      case 'continue':
        instructions += `1. Install Continue.dev extension in VS Code\n`;
        instructions += `2. Choose ONE of the following methods:\n\n`;
        instructions += `   Option A: Global Config (applies to all workspaces)\n`;
        instructions += `   - Open: ${paths.continue}\n`;
        instructions += `   - Add this to the "mcpServers" array:\n\n`;
        instructions += `   mcpServers:\n`;
        instructions += `     - name: Context Sync\n`;
        instructions += `       type: stdio\n`;
        instructions += `       command: npx\n`;
        instructions += `       args:\n`;
        instructions += `         - -y\n`;
        instructions += `         - @context-sync/server\n`;
        instructions += `       env: {}\n\n`;
        instructions += `   Option B: Workspace Config (per-project)\n`;
        instructions += `   - Create: .continue/mcpServers/context-sync.yaml\n`;
        instructions += `   - Add this content:\n\n`;
        instructions += `   name: Context Sync\n`;
        instructions += `   type: stdio\n`;
        instructions += `   command: npx\n`;
        instructions += `   args:\n`;
        instructions += `     - -y\n`;
        instructions += `     - @context-sync/server\n`;
        instructions += `   env: {}\n\n`;
        instructions += `3. Restart VS Code or reload the Continue.dev extension\n`;
        instructions += `4. Make sure Agent Mode is enabled in Continue.dev\n`;
        break;

      case 'zed':
        instructions += `1. Install Context Sync extension for Zed (coming soon)\n`;
        instructions += `2. Or configure manually in: ${paths.zed}\n`;
        instructions += `3. Add MCP server configuration\n`;
        instructions += `\nNote: Zed MCP support is experimental\n`;
        break;

      case 'windsurf':
        instructions += `1. Open: ${paths.windsurf}\n`;
        instructions += `2. Add this to the "mcpServers" section:\n\n`;
        instructions += `"context-sync": {\n`;
        instructions += `  "command": "npx",\n`;
        instructions += `  "args": ["-y", "@context-sync/server"]\n`;
        instructions += `}\n\n`;
        instructions += `3. Restart Windsurf\n`;
        break;



      case 'tabnine':
        instructions += `1. Install TabNine extension in your IDE\n`;
        instructions += `2. Create/edit config: ${paths.tabnine}\n`;
        instructions += `3. Add Context Sync server configuration:\n`;
        instructions += `   {\n`;
        instructions += `     "mcpServers": {\n`;
        instructions += `       "context-sync": {\n`;
        instructions += `         "command": "npx",\n`;
        instructions += `         "args": ["-y", "@context-sync/server"]\n`;
        instructions += `       }\n`;
        instructions += `     }\n`;
        instructions += `   }\n`;
        instructions += `4. Restart TabNine Agent\n`;
        instructions += `\nNote: Uses TabNine's native MCP support\n`;
        break;



      default:
        instructions += `Platform "${platform}" is not yet supported.\n`;
        instructions += `\nWant to add support? Contribute at:\n`;
        instructions += `https://github.com/Intina47/context-sync\n`;
    }

    return instructions;
  }
}
