/**
 * Enhanced Platform Configuration Database
 * 
 * Extended configuration with multiple detection strategies for robust cross-platform support.
 */

const path = require('path');
const os = require('os');

const ENHANCED_PLATFORM_CONFIGS = {
  claude: {
    name: 'Claude Desktop',
    mcpSupport: 'native',
    
    // Multiple detection strategies
    processNames: ['Claude', 'claude'],
    commands: ['claude'],
    packageNames: ['claude-desktop', 'claude'],
    environmentVars: ['CLAUDE_HOME', 'CLAUDE_PATH'],
    
    // Windows Registry keys
    registryKeys: [
      'HKEY_CURRENT_USER\\Software\\Anthropic\\Claude',
      'HKEY_LOCAL_MACHINE\\Software\\Anthropic\\Claude',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Claude'
    ],
    
    // Fallback filesystem paths
    detection: {
      paths: {
        darwin: [
          '/Applications/Claude.app',
          path.join(os.homedir(), 'Applications', 'Claude.app'),
          '/System/Applications/Claude.app'
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'AnthropicClaude'),
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Claude'),
          path.join(process.env.PROGRAMFILES || '', 'Claude'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Claude'),
          'C:\\Program Files\\Claude',
          'C:\\Program Files (x86)\\Claude'
        ],
        linux: [
          '/usr/bin/claude',
          '/usr/local/bin/claude',
          '/opt/claude/claude',
          '/snap/bin/claude',
          path.join(os.homedir(), '.local', 'bin', 'claude'),
          path.join(os.homedir(), '.local', 'share', 'applications', 'claude.desktop')
        ]
      }
    },
    
    config: {
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        win32: path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json'),
        linux: path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json')
      },
      format: 'json',
      structure: {
        mcpServers: {
          'context-sync': {
            command: 'node',
            args: ['{{packagePath}}']
          }
        }
      }
    }
  },

  cursor: {
    name: 'Cursor IDE',
    mcpSupport: 'native',
    
    processNames: ['Cursor', 'cursor'],
    commands: ['cursor'],
    packageNames: ['cursor', 'cursor-ide'],
    environmentVars: ['CURSOR_HOME', 'CURSOR_PATH'],
    
    registryKeys: [
      'HKEY_CURRENT_USER\\Software\\Cursor',
      'HKEY_LOCAL_MACHINE\\Software\\Cursor',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cursor'
    ],
    
    detection: {
      paths: {
        darwin: [
          '/Applications/Cursor.app',
          path.join(os.homedir(), 'Applications', 'Cursor.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor'),
          path.join(process.env.PROGRAMFILES || '', 'Cursor'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Cursor'),
          'C:\\Program Files\\Cursor',
          'C:\\Program Files (x86)\\Cursor'
        ],
        linux: [
          '/usr/bin/cursor',
          '/usr/local/bin/cursor',
          '/opt/cursor/cursor',
          '/snap/bin/cursor',
          path.join(os.homedir(), '.local', 'bin', 'cursor'),
          path.join(os.homedir(), '.local', 'share', 'applications', 'cursor.desktop')
        ]
      }
    },
    
    config: {
      paths: {
        darwin: path.join(os.homedir(), '.cursor', 'mcp.json'),
        win32: path.join(process.env.USERPROFILE || '', '.cursor', 'mcp.json'),
        linux: path.join(os.homedir(), '.cursor', 'mcp.json')
      },
      format: 'json',
      structure: {
        mcpServers: {
          'context-sync': {
            command: 'node',
            args: ['{{packagePath}}'],
            type: 'stdio'
          }
        }
      }
    }
  },

  copilot: {
    name: 'GitHub Copilot (VS Code)',
    mcpSupport: 'extension',
    
    processNames: ['Code', 'code'],
    commands: ['code'],
    packageNames: ['visual-studio-code', 'code'],
    environmentVars: ['VSCODE_HOME', 'CODE_HOME'],
    
    registryKeys: [
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{EA457B21-F73E-494C-ACAB-524FDE069978}_is1',
      'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{EA457B21-F73E-494C-ACAB-524FDE069978}_is1'
    ],
    
    detection: {
      paths: {
        darwin: [
          '/Applications/Visual Studio Code.app',
          path.join(os.homedir(), 'Applications', 'Visual Studio Code.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
          path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft VS Code'),
          'C:\\Program Files\\Microsoft VS Code',
          'C:\\Program Files (x86)\\Microsoft VS Code'
        ],
        linux: [
          '/usr/bin/code',
          '/usr/local/bin/code',
          '/opt/visual-studio-code/code',
          '/snap/bin/code',
          path.join(os.homedir(), '.local', 'bin', 'code')
        ]
      },
      extensionCheck: {
        darwin: path.join(os.homedir(), '.vscode', 'extensions'),
        win32: path.join(process.env.USERPROFILE || '', '.vscode', 'extensions'),
        linux: path.join(os.homedir(), '.vscode', 'extensions')
      }
    },
    
    config: {
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
        win32: path.join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json'),
        linux: path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json')
      },
      format: 'json',
      structure: {
        servers: {
          'context-sync': {
            command: 'node',
            args: ['{{packagePath}}'],
            type: 'stdio'
          }
        },
        inputs: []
      }
    }
  },

  zed: {
    name: 'Zed Editor',
    mcpSupport: 'native',
    
    processNames: ['Zed', 'zed'],
    commands: ['zed'],
    packageNames: ['zed', 'zed-editor'],
    environmentVars: ['ZED_HOME', 'ZED_PATH'],
    
    registryKeys: [
      'HKEY_CURRENT_USER\\Software\\Zed',
      'HKEY_LOCAL_MACHINE\\Software\\Zed'
    ],
    
    detection: {
      paths: {
        darwin: [
          '/Applications/Zed.app',
          path.join(os.homedir(), 'Applications', 'Zed.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Zed'),
          path.join(process.env.PROGRAMFILES || '', 'Zed'),
          'C:\\Program Files\\Zed',
          'C:\\Program Files (x86)\\Zed'
        ],
        linux: [
          '/usr/bin/zed',
          '/usr/local/bin/zed',
          '/opt/zed/zed',
          '/snap/bin/zed',
          path.join(os.homedir(), '.local', 'bin', 'zed')
        ]
      }
    },
    
    config: {
      paths: {
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Zed', 'settings.json'),
        win32: path.join(process.env.APPDATA || '', 'Zed', 'settings.json'),
        linux: path.join(os.homedir(), '.config', 'zed', 'settings.json')
      },
      format: 'json-merge',
      structure: {
        context_servers: {
          'context-sync': {
            source: 'custom',
            command: 'node',
            args: ['{{packagePath}}'],
            env: {}
          }
        }
      }
    }
  },

  windsurf: {
    name: 'Windsurf by Codeium',
    mcpSupport: 'native',
    
    processNames: ['Windsurf', 'windsurf'],
    commands: ['windsurf'],
    packageNames: ['windsurf', 'windsurf-codeium'],
    environmentVars: ['WINDSURF_HOME', 'WINDSURF_PATH'],
    
    registryKeys: [
      'HKEY_CURRENT_USER\\Software\\Codeium\\Windsurf',
      'HKEY_LOCAL_MACHINE\\Software\\Codeium\\Windsurf'
    ],
    
    detection: {
      paths: {
        darwin: [
          '/Applications/Windsurf.app',
          path.join(os.homedir(), 'Applications', 'Windsurf.app')
        ],
        win32: [
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Windsurf'),
          path.join(process.env.PROGRAMFILES || '', 'Windsurf'),
          'C:\\Program Files\\Windsurf',
          'C:\\Program Files (x86)\\Windsurf'
        ],
        linux: [
          '/usr/bin/windsurf',
          '/usr/local/bin/windsurf',
          '/opt/windsurf/windsurf',
          '/snap/bin/windsurf'
        ]
      }
    },
    
    config: {
      paths: {
        darwin: path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
        win32: path.join(process.env.USERPROFILE || '', '.codeium', 'windsurf', 'mcp_config.json'),
        linux: path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json')
      },
      format: 'json',
      structure: {
        mcpServers: {
          'context-sync': {
            command: 'node',
            args: ['{{packagePath}}']
          }
        }
      }
    }
  }
};

module.exports = ENHANCED_PLATFORM_CONFIGS;