/**
 * Platform Configuration Database
 * 
 * Research-based configuration paths and methods for each AI platform.
 * This file contains the exact methods to auto-configure MCP for each platform.
 */

const path = require('path');
const os = require('os');

// Platform configuration database with auto-detection and setup methods
const PLATFORM_CONFIGS = {
  // ============================================================================
  // CORE PLATFORMS (Full MCP Support)
  // ============================================================================
  
  claude: {
    name: 'Claude Desktop',
    mcpSupport: 'native',
    enabled: true,
    detection: {
      // Check if Claude Desktop is installed
      paths: {
        darwin: [
          '/Applications/Claude.app',
          path.join(os.homedir(), 'Applications', 'Claude.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'AnthropicClaude'),
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Claude'),
          path.join(process.env.PROGRAMFILES || '', 'Claude'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Claude')
        ],
        linux: [
          '/usr/bin/claude',
          '/usr/local/bin/claude',
          path.join(os.homedir(), '.local', 'share', 'applications', 'claude.desktop')
        ]
      }
    },
    config: {
      // Configuration file locations
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        win32: path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json'),
        linux: path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'mcpServers'
      }
    }
  },

  cursor: {
    name: 'Cursor IDE',
    mcpSupport: 'native',
    enabled: true,
    detection: {
      // Check if Cursor is installed
      paths: {
        darwin: [
          '/Applications/Cursor.app',
          path.join(os.homedir(), 'Applications', 'Cursor.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor'),
          path.join(process.env.PROGRAMFILES || '', 'Cursor'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Cursor')
        ],
        linux: [
          '/usr/bin/cursor',
          '/usr/local/bin/cursor',
          '/opt/cursor/cursor',
          path.join(os.homedir(), '.local', 'share', 'applications', 'cursor.desktop')
        ]
      }
    },
    config: {
      // Cursor uses a different MCP config path than VS Code
      paths: {
        darwin: path.join(os.homedir(), '.cursor', 'mcp.json'),
        win32: path.join(process.env.USERPROFILE || '', '.cursor', 'mcp.json'),
        linux: path.join(os.homedir(), '.cursor', 'mcp.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'mcpServers'
      },
      serverOverrides: {
        type: 'stdio'
      }
    }
  },

  copilot: {
    name: 'GitHub Copilot (VS Code)',
    mcpSupport: 'extension',
    enabled: true,
    detection: {
      // Check if VS Code is installed (required for Copilot)
      paths: {
        darwin: [
          '/Applications/Visual Studio Code.app',
          path.join(os.homedir(), 'Applications', 'Visual Studio Code.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
          path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft VS Code')
        ],
        linux: [
          '/usr/bin/code',
          '/usr/local/bin/code',
          '/opt/visual-studio-code/code',
          '/snap/bin/code'
        ]
      },
      // Also check if Copilot extension is installed
      extensionCheck: {
        darwin: path.join(os.homedir(), '.vscode', 'extensions'),
        win32: path.join(process.env.USERPROFILE || '', '.vscode', 'extensions'),
        linux: path.join(os.homedir(), '.vscode', 'extensions')
      }
    },
    config: {
      // VS Code MCP configuration
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
        win32: path.join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json'),
        linux: path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'servers',
        rootExtras: { inputs: [] }
      },
      serverOverrides: {
        type: 'stdio'
      }
    }
  },

  // ============================================================================
  // EXTENDED PLATFORMS (Growing MCP Support)
  // ============================================================================

  continue: {
    name: 'Continue.dev',
    mcpSupport: 'native',
    enabled: true,
    detection: {
      // Continue can be detected via global config, workspace config, or VS Code extension
      paths: {
        darwin: [
          path.join(os.homedir(), '.continue', 'config.yaml'),
          path.join(process.cwd(), '.continue'),
          path.join(os.homedir(), '.vscode', 'extensions')
        ],
        win32: [
          path.join(process.env.USERPROFILE || '', '.continue', 'config.yaml'),
          path.join(process.cwd(), '.continue'),
          path.join(process.env.USERPROFILE || '', '.vscode', 'extensions')
        ],
        linux: [
          path.join(os.homedir(), '.continue', 'config.yaml'),
          path.join(process.cwd(), '.continue'),
          path.join(os.homedir(), '.vscode', 'extensions')
        ]
      },
      extensionId: 'continue.continue'
    },
    config: {
      // Continue supports both global and workspace-level configs
      // Global config: ~/.continue/config.yaml with mcpServers array
      globalPath: {
        darwin: path.join(os.homedir(), '.continue', 'config.yaml'),
        win32: path.join(process.env.USERPROFILE || '', '.continue', 'config.yaml'),
        linux: path.join(os.homedir(), '.continue', 'config.yaml')
      },
      // Workspace config: .continue/mcpServers/*.yaml files (direct server definition)
      workspaceRelativePath: path.join('.continue', 'mcpServers'),
      format: 'continue-yaml',
      serverOverrides: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@context-sync/server'],
        env: {}
      }
    }
  },

  zed: {
    name: 'Zed Editor',
    mcpSupport: 'native',
    enabled: true,
    detection: {
      paths: {
        darwin: [
          '/Applications/Zed.app',
          path.join(os.homedir(), 'Applications', 'Zed.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Zed'),
          path.join(process.env.PROGRAMFILES || '', 'Zed')
        ],
        linux: [
          '/usr/bin/zed',
          '/usr/local/bin/zed',
          path.join(os.homedir(), '.local', 'bin', 'zed')
        ]
      }
    },
    config: {
      // Zed uses context_servers in settings.json
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Zed', 'settings.json'),
        win32: path.join(process.env.APPDATA || '', 'Zed', 'settings.json'),
        linux: path.join(os.homedir(), '.config', 'zed', 'settings.json')
      },
      format: 'json-merge',
      adapter: {
        kind: 'json',
        containerKey: 'context_servers'
      },
      serverOverrides: {
        source: 'custom',
        env: {}
      }
    }
  },

  windsurf: {
    name: 'Windsurf by Codeium',
    mcpSupport: 'native',
    enabled: true,
    detection: {
      paths: {
        darwin: [
          '/Applications/Windsurf.app',
          path.join(os.homedir(), 'Applications', 'Windsurf.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Windsurf'),
          path.join(process.env.PROGRAMFILES || '', 'Windsurf')
        ],
        linux: [
          '/usr/bin/windsurf',
          '/usr/local/bin/windsurf'
        ]
      }
    },
    config: {
      // Windsurf uses .codeium directory with mcp_config.json filename
      paths: {
        darwin: path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),  
        win32: path.join(process.env.USERPROFILE || '', '.codeium', 'windsurf', 'mcp_config.json'),
        linux: path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'mcpServers'
      }
    }
  },

  codeium: {
    name: 'Codeium',
    mcpSupport: 'extension',
    enabled: true,
    detection: {
      // Codeium is usually a VS Code extension
      paths: {
        darwin: path.join(os.homedir(), '.vscode', 'extensions'),
        win32: path.join(process.env.USERPROFILE || '', '.vscode', 'extensions'),
        linux: path.join(os.homedir(), '.vscode', 'extensions')
      },
      extensionId: 'codeium.codeium'
    },
    config: {
      // Codeium might use VS Code's settings or have its own config
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
        win32: path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json'),
        linux: path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json')
      },
      format: 'json-setting',
      adapter: {
        kind: 'json',
        flatKey: 'codeium.mcp',
        containerKey: 'servers'
      }
    }
  },

  tabnine: {
    name: 'TabNine',
    mcpSupport: 'extension',
    enabled: true,
    detection: {
      // TabNine has both standalone and extension versions
      paths: {
        darwin: [
          path.join(os.homedir(), 'Library', 'Application Support', 'TabNine'),
          path.join(os.homedir(), '.vscode', 'extensions')
        ],
        win32: [
          path.join(process.env.APPDATA || '', 'TabNine'),
          path.join(process.env.USERPROFILE || '', '.vscode', 'extensions')
        ],
        linux: [
          path.join(os.homedir(), '.config', 'TabNine'),
          path.join(os.homedir(), '.vscode', 'extensions')
        ]
      },
      extensionId: 'tabnine.tabnine-vscode'
    },
    config: {
      // TabNine configuration (needs research)
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'TabNine', 'config.json'),
        win32: path.join(process.env.APPDATA || '', 'TabNine', 'config.json'),
        linux: path.join(os.homedir(), '.config', 'TabNine', 'config.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'mcp.servers'
      }
    }
  },

  // ============================================================================
  // CLI/IDE PLATFORMS (New)
  // ============================================================================

  codex: {
    name: 'OpenAI Codex CLI',
    mcpSupport: 'cli',
    enabled: true,
    detection: {
      paths: {
        darwin: [path.join(os.homedir(), '.codex', 'config.toml')],
        win32: [path.join(os.homedir(), '.codex', 'config.toml')],
        linux: [path.join(os.homedir(), '.codex', 'config.toml')]
      }
    },
    config: {
      paths: {
        darwin: path.join(os.homedir(), '.codex', 'config.toml'),
        win32: path.join(os.homedir(), '.codex', 'config.toml'),
        linux: path.join(os.homedir(), '.codex', 'config.toml')
      },
      format: 'toml',
      tomlTableKey: 'mcp_servers.context-sync',
      omitName: true,
      serverOverrides: {
        command: 'npx',
        args: ['-y', '@context-sync/server']
      }
    }
  },

  'claude-code': {
    name: 'Claude Code',
    mcpSupport: 'cli',
    enabled: true,
    detection: {
      command: 'claude mcp list',
      paths: {
        darwin: [path.join(os.homedir(), '.claude', 'mcp_servers.json')],
        win32: [path.join(os.homedir(), '.claude', 'mcp_servers.json')],
        linux: [path.join(os.homedir(), '.claude', 'mcp_servers.json')]
      }
    },
    config: {
      paths: {
        darwin: path.join(os.homedir(), '.claude', 'mcp_servers.json'),
        win32: path.join(os.homedir(), '.claude', 'mcp_servers.json'),
        linux: path.join(os.homedir(), '.claude', 'mcp_servers.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'mcpServers'
      },
      serverOverrides: {
        command: 'npx',
        args: ['-y', '@context-sync/server']
      }
    }
  },

  antigravity: {
    name: 'Google Antigravity',
    mcpSupport: 'native',
    enabled: true,
    detection: {
      paths: {
        darwin: [path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json')],
        win32: [path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json')],
        linux: [path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json')]
      }
    },
    config: {
      paths: {
        darwin: path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
        win32: path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
        linux: path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json')
      },
      format: 'json',
      adapter: {
        kind: 'json',
        containerKey: 'mcpServers'
      },
      serverOverrides: {
        command: 'npx',
        args: ['-y', '@context-sync/server']
      }
    }
  },

  // ============================================================================
  // TODO PLATFORMS (Stubs - configuration pending)
  // ============================================================================

  'continue-dev': {
    name: 'Continue.dev (App)',
    mcpSupport: 'unknown',
    enabled: false,
    todo: true,
    note: 'TODO: clarify if distinct from Continue extension and add config paths'
  }
};

module.exports = PLATFORM_CONFIGS;
