/**
 * Enhanced Platform Detection System
 * 
 * This module provides robust cross-platform detection that doesn't rely on hardcoded paths.
 * It uses multiple detection strategies to find AI platforms regardless of installation location.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnhancedPlatformDetector {
  constructor() {
    this.platform = process.platform;
    this.cache = new Map(); // Cache detection results
  }

  /**
   * Detect platform using multiple strategies
   */
  async detectPlatform(platformId, config) {
    // Check cache first
    if (this.cache.has(platformId)) {
      return this.cache.get(platformId);
    }

    const strategies = [
      () => this.detectByProcess(platformId, config),
      () => this.detectByRegistry(platformId, config),
      () => this.detectByCommand(platformId, config),
      () => this.detectByCommonPaths(platformId, config),
      () => this.detectByPackageManager(platformId, config),
      () => this.detectByEnvironment(platformId, config)
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) {
          this.cache.set(platformId, result);
          return result;
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    this.cache.set(platformId, null);
    return null;
  }

  /**
   * Strategy 1: Detect by running processes
   */
  async detectByProcess(platformId, config) {
    if (!config.processNames) return null;

    try {
      let processes;
      if (this.platform === 'win32') {
        const output = execSync('tasklist /FO CSV', { encoding: 'utf8' });
        processes = output.toLowerCase();
      } else {
        const output = execSync('ps aux', { encoding: 'utf8' });
        processes = output.toLowerCase();
      }

      for (const processName of config.processNames) {
        if (processes.includes(processName.toLowerCase())) {
          // Found running process, try to get executable path
          return await this.getExecutablePathFromProcess(processName);
        }
      }
    } catch (error) {
      // Process detection failed
    }

    return null;
  }

  /**
   * Strategy 2: Windows Registry detection
   */
  async detectByRegistry(platformId, config) {
    if (this.platform !== 'win32' || !config.registryKeys) return null;

    try {
      for (const registryKey of config.registryKeys) {
        const output = execSync(`reg query "${registryKey}" /s 2>nul`, { encoding: 'utf8' });
        if (output) {
          // Parse registry output to find installation path
          const match = output.match(/InstallLocation\s+REG_SZ\s+(.+)/i);
          if (match) {
            const installPath = match[1].trim();
            if (fs.existsSync(installPath)) {
              return { path: installPath, method: 'registry' };
            }
          }
        }
      }
    } catch (error) {
      // Registry detection failed
    }

    return null;
  }

  /**
   * Strategy 3: Command-line detection
   */
  async detectByCommand(platformId, config) {
    if (!config.commands) return null;

    for (const command of config.commands) {
      try {
        const output = execSync(`${command} --version 2>/dev/null || ${command} -v 2>/dev/null`, { 
          encoding: 'utf8',
          timeout: 5000 
        });
        
        if (output) {
          // Try to get the full path of the command
          const whichCommand = this.platform === 'win32' ? 'where' : 'which';
          const pathOutput = execSync(`${whichCommand} ${command}`, { encoding: 'utf8' });
          return { path: pathOutput.trim(), method: 'command' };
        }
      } catch (error) {
        // Command not found, continue
      }
    }

    return null;
  }

  /**
   * Strategy 4: Enhanced common paths detection
   */
  async detectByCommonPaths(platformId, config) {
    const allPaths = this.getAllPossiblePaths(platformId, config);
    
    for (const checkPath of allPaths) {
      if (fs.existsSync(checkPath)) {
        return { path: checkPath, method: 'filesystem' };
      }
    }

    return null;
  }

  /**
   * Strategy 5: Package manager detection
   */
  async detectByPackageManager(platformId, config) {
    if (!config.packageNames) return null;

    const packageManagers = this.getPackageManagers();
    
    for (const pm of packageManagers) {
      for (const packageName of config.packageNames) {
        try {
          const result = await this.checkPackageManager(pm, packageName);
          if (result) {
            return { path: result, method: 'package-manager' };
          }
        } catch (error) {
          // Continue to next package manager
        }
      }
    }

    return null;
  }

  /**
   * Strategy 6: Environment variable detection
   */
  async detectByEnvironment(platformId, config) {
    if (!config.environmentVars) return null;

    for (const envVar of config.environmentVars) {
      const value = process.env[envVar];
      if (value && fs.existsSync(value)) {
        return { path: value, method: 'environment' };
      }
    }

    return null;
  }

  /**
   * Get all possible installation paths for a platform
   */
  getAllPossiblePaths(platformId, config) {
    const paths = [];
    
    // Original configured paths
    if (config.detection?.paths?.[this.platform]) {
      paths.push(...config.detection.paths[this.platform]);
    }

    // Platform-specific common locations
    paths.push(...this.getPlatformSpecificPaths(platformId));
    
    // User-specific locations
    paths.push(...this.getUserSpecificPaths(platformId));
    
    // System-wide locations
    paths.push(...this.getSystemWidePaths(platformId));

    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Get platform-specific installation paths
   */
  getPlatformSpecificPaths(platformId) {
    const paths = [];
    const home = os.homedir();

    switch (this.platform) {
      case 'win32':
        // Windows common installation directories
        const commonDirs = [
          process.env.LOCALAPPDATA,
          process.env.APPDATA,
          process.env.PROGRAMFILES,
          process.env['PROGRAMFILES(X86)'],
          'C:\\Program Files',
          'C:\\Program Files (x86)',
          path.join(home, 'AppData', 'Local'),
          path.join(home, 'AppData', 'Roaming')
        ].filter(Boolean);

        const appNames = this.getAppVariations(platformId);
        for (const dir of commonDirs) {
          for (const appName of appNames) {
            paths.push(path.join(dir, appName));
            paths.push(path.join(dir, 'Programs', appName));
          }
        }
        break;

      case 'darwin':
        // macOS common installation directories
        const macDirs = [
          '/Applications',
          path.join(home, 'Applications'),
          '/System/Applications',
          '/usr/local/bin',
          '/opt/homebrew/bin'
        ];

        const macAppNames = this.getAppVariations(platformId);
        for (const dir of macDirs) {
          for (const appName of macAppNames) {
            paths.push(path.join(dir, `${appName}.app`));
            paths.push(path.join(dir, appName));
          }
        }
        break;

      case 'linux':
        // Linux common installation directories
        const linuxDirs = [
          '/usr/bin',
          '/usr/local/bin',
          '/opt',
          '/snap/bin',
          path.join(home, '.local', 'bin'),
          path.join(home, 'bin'),
          '/usr/share/applications'
        ];

        const linuxAppNames = this.getAppVariations(platformId);
        for (const dir of linuxDirs) {
          for (const appName of linuxAppNames) {
            paths.push(path.join(dir, appName));
            paths.push(path.join(dir, `${appName}.desktop`));
          }
        }
        break;
    }

    return paths;
  }

  /**
   * Get various name variations for an app
   */
  getAppVariations(platformId) {
    const variations = [platformId];
    
    const nameMap = {
      'claude': ['Claude', 'claude', 'AnthropicClaude', 'Claude Desktop'],
      'cursor': ['Cursor', 'cursor'],
      'copilot': ['code', 'Code', 'Visual Studio Code', 'Microsoft VS Code'],
      'zed': ['Zed', 'zed'],
      'windsurf': ['Windsurf', 'windsurf'],
      'continue': ['continue', 'Continue'],
      'codeium': ['Codeium', 'codeium'],
      'tabnine': ['TabNine', 'tabnine']
    };

    return nameMap[platformId] || [platformId];
  }

  /**
   * Get user-specific paths
   */
  getUserSpecificPaths(platformId) {
    // Implementation for user-specific detection
    return [];
  }

  /**
   * Get system-wide paths
   */
  getSystemWidePaths(platformId) {
    // Implementation for system-wide detection
    return [];
  }

  /**
   * Get available package managers
   */
  getPackageManagers() {
    const managers = [];
    
    switch (this.platform) {
      case 'win32':
        managers.push('winget', 'choco', 'scoop');
        break;
      case 'darwin':
        managers.push('brew', 'port');
        break;
      case 'linux':
        managers.push('apt', 'yum', 'dnf', 'pacman', 'snap', 'flatpak');
        break;
    }

    return managers;
  }

  /**
   * Check if package is installed via package manager
   */
  async checkPackageManager(pm, packageName) {
    // Implementation for package manager checks
    return null;
  }

  /**
   * Get executable path from running process
   */
  async getExecutablePathFromProcess(processName) {
    // Implementation to get full path from process name
    return null;
  }
}

module.exports = EnhancedPlatformDetector;