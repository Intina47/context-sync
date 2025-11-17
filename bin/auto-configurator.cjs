#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const PLATFORM_CONFIGS = require('./platform-configs.cjs');
const TieredDetector = require('./tiered-detector.cjs');
const yaml = require('js-yaml');

/**
 * Platform Detection and Auto-Configuration System
 * 
 * This module handles:
 * 1. Detecting which AI platforms/tools are installed
 * 2. Auto-configuring MCP for each detected platform
 * 3. Creating backup files before modifications
 * 4. Providing detailed setup results
 */

class PlatformAutoConfigurator {
  constructor(packagePath, verbose = false) {
    this.packagePath = packagePath;
    this.verbose = verbose;
    this.platform = os.platform();
    this.tieredDetector = new TieredDetector();
    this.results = {
      detected: [],
      configured: [],
      skipped: [],
      errors: []
    };
  }

  /**
   * Main entry point - detect and configure all platforms
   */
  async configureAllPlatforms() {
    console.log('🔍 Scanning for installed AI platforms...\n');

    // Focus on local development and desktop apps first
    const localPlatforms = ['claude', 'cursor', 'copilot', 'continue', 'zed', 'windsurf', 'codeium', 'tabnine'];
    
    for (const platformId of localPlatforms) {
      const config = PLATFORM_CONFIGS[platformId];
      if (!config) continue;

      console.log(`🔍 Checking ${config.name}...`);
      
      const isInstalled = await this.detectPlatform(platformId, config);
      if (isInstalled) {
        this.results.detected.push(platformId);
        console.log(`   ✅ ${config.name} detected`);
        
        const configResult = await this.configurePlatform(platformId, config);
        if (configResult.success) {
          this.results.configured.push(platformId);
          console.log(`   🔧 ${config.name} configured successfully`);
        } else {
          this.results.skipped.push({ platform: platformId, reason: configResult.reason });
          console.log(`   ⚠️  ${config.name} skipped: ${configResult.reason}`);
        }
      } else {
        console.log(`   ⚪ ${config.name} not installed`);
      }
      console.log('');
    }

    return this.results;
  }

  /**
   * Detect if a platform is installed on the system
   * Uses tiered detection: current working method first, enhanced as fallback
   */
  async detectPlatform(platformId, config) {
    const result = await this.tieredDetector.detectPlatform(platformId, config);
    
    if (result) {
      const reliabilityNote = result.reliable ? '' : ' (fallback detection)';
      if (this.verbose) {
        console.log(`     Found via ${result.method}: ${result.path}${reliabilityNote}`);
      }
      return true;
    }

    return false;
  }

  /**
   * Check if a VS Code extension is installed
   */
  async checkVSCodeExtension(platformId, detection) {
    let extensionsPath;
    
    if (detection.extensionCheck) {
      extensionsPath = detection.extensionCheck[this.platform];
    } else if (detection.paths) {
      extensionsPath = detection.paths[this.platform];
    }

    if (!extensionsPath || !fs.existsSync(extensionsPath)) {
      return false;
    }

    try {
      const extensions = fs.readdirSync(extensionsPath);
      
      // Look for specific extension ID
      if (detection.extensionId) {
        const found = extensions.some(ext => ext.startsWith(detection.extensionId));
        if (found && this.verbose) {
          console.log(`     Extension found: ${detection.extensionId}`);
        }
        return found;
      }

      // For Copilot, look for github.copilot extension
      if (platformId === 'copilot') {
        const copilotFound = extensions.some(ext => 
          ext.includes('github.copilot') || ext.includes('copilot')
        );
        if (copilotFound && this.verbose) {
          console.log(`     GitHub Copilot extension found`);
        }
        return copilotFound;
      }

      return false;
    } catch (error) {
      if (this.verbose) console.log(`     Error checking extensions: ${error.message}`);
      return false;
    }
  }

  /**
   * Configure MCP for a specific platform
   */
  async configurePlatform(platformId, config) {
    const configInfo = config.config;
    
    if (!configInfo.paths || !configInfo.paths[this.platform]) {
      return { success: false, reason: 'No configuration path for this platform' };
    }

    const configPath = configInfo.paths[this.platform];
    const configDir = path.dirname(configPath);

    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        if (this.verbose) console.log(`     Created directory: ${configDir}`);
      }

      // Handle different configuration formats
      switch (configInfo.format) {
        case 'json':
          return await this.configureJsonFile(configPath, configInfo, platformId);
        
        case 'json-setting':
          return await this.configureJsonSetting(configPath, configInfo, platformId);
        
        case 'json-merge':
          return await this.configureJsonFile(configPath, configInfo, platformId);
        
        case 'continue-yaml':
          return await this.configureContinueYaml(configInfo, platformId);
        
        default:
          return { success: false, reason: 'Unsupported configuration format' };
      }

    } catch (error) {
      this.results.errors.push({ platform: platformId, error: error.message });
      return { success: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Configure JSON-based config files (Claude, Cursor, VS Code, etc.)
   */
  async configureJsonFile(configPath, configInfo, platformId) {
    let config = {};

    // Read existing config or create new one
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(content);
      } catch (error) {
        if (this.verbose) console.log(`     Warning: Could not parse existing config, creating new one`);
        config = {};
      }
    }

    // Check if already configured BEFORE merging
    const contextSyncKey = this.findContextSyncConfig(config);
    if (contextSyncKey) {
      return { success: false, reason: 'Already configured' };
    }

    // Create structure from template
    const template = configInfo.structure;
    const newConfig = this.processTemplate(template, this.packagePath);

    // Merge configurations
    config = this.mergeConfigs(config, newConfig);

    // Create backup
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
      if (this.verbose) console.log(`     Backup created: ${backupPath}`);
    }

    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  }

  /**
   * Configure JSON settings (for platforms that use settings.json)
   */
  async configureJsonSetting(configPath, configInfo, platformId) {
    // Similar to configureJsonFile but handles VS Code settings format
    // This would merge MCP settings into the larger settings.json file
    return await this.configureJsonFile(configPath, configInfo, platformId);
  }

  /**
   * Configure Continue.dev by writing workspace YAML or global config
   * Supports both workspace-level (.continue/mcpServers/*.yaml) and global (~/.continue/config.yaml)
   */
  async configureContinueYaml(configInfo, platformId) {
    // Strategy: Try workspace config first (better for multi-project setups),
    // fall back to global config if workspace doesn't work
    const workspaceResult = await this.configureContinueWorkspace(configInfo, platformId);
    
    if (workspaceResult.success) {
      return workspaceResult;
    }

    // If workspace config fails, try global config as fallback
    if (this.verbose) {
      console.log(`     Workspace config failed, trying global config...`);
    }
    
    const globalResult = await this.configureContinueGlobal(configInfo, platformId);
    return globalResult;
  }

  /**
   * Configure Continue.dev workspace-level YAML under .continue/mcpServers/
   * This creates a per-workspace configuration file
   */
  async configureContinueWorkspace(configInfo, platformId) {
    // Determine workspace path (use current working directory)
    const workspaceRoot = process.cwd();
    const rel = configInfo.workspaceRelativePath || path.join('.continue', 'mcpServers');
    const targetDir = path.join(workspaceRoot, rel);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        if (this.verbose) console.log(`     Created workspace mcpServers dir: ${targetDir}`);
      }

      // Use workspaceStructure (direct server definition, NOT nested)
      const structure = configInfo.workspaceStructure || configInfo.structure || {
        name: 'Context Sync',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@context-sync/server'],
        env: {}
      };

      // Determine file name - use a simple, standard name
      const fileName = 'context-sync.yaml';
      const filePath = path.join(targetDir, fileName);

      // Check if already configured
      if (fs.existsSync(filePath)) {
        const existing = fs.readFileSync(filePath, 'utf8');
        if (existing.includes('Context Sync') || existing.includes('context-sync') || existing.includes('@context-sync/server')) {
          if (this.verbose) console.log(`     Already configured in workspace`);
          return { success: false, reason: 'Already configured' };
        }
        
        // Backup existing file
        const backupPath = `${filePath}.backup.${Date.now()}`;
        fs.copyFileSync(filePath, backupPath);
        if (this.verbose) console.log(`     Backup created: ${backupPath}`);
      }

      // Process template (replace {{packagePath}} if present)
      const processed = this.processTemplate(structure, this.packagePath);
      
      // Convert to YAML - workspace configs use direct server definition
      const yamlText = this.objectToYaml(processed);

      fs.writeFileSync(filePath, yamlText, 'utf8');
      if (this.verbose) console.log(`     Created workspace config: ${filePath}`);
      return { success: true, path: filePath, type: 'workspace' };
    } catch (error) {
      if (this.verbose) console.log(`     Workspace config error: ${error.message}`);
      return { success: false, reason: `Error writing workspace YAML: ${error.message}` };
    }
  }

  /**
   * Configure Continue.dev global config (~/.continue/config.yaml)
   * This adds Context Sync to the global mcpServers array
   */
  async configureContinueGlobal(configInfo, platformId) {
    const globalPath = configInfo.globalPath && configInfo.globalPath[this.platform];
    
    if (!globalPath) {
      return { success: false, reason: 'No global config path defined for this platform' };
    }

    try {
      // Ensure directory exists
      const configDir = path.dirname(globalPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        if (this.verbose) console.log(`     Created global config dir: ${configDir}`);
      }

      // Read existing config or create new one
      let configObj = {};
      if (fs.existsSync(globalPath)) {
        try {
          const raw = fs.readFileSync(globalPath, 'utf8');
          configObj = yaml.load(raw) || {};
        } catch (error) {
          if (this.verbose) console.log(`     Warning: Could not parse existing global config, creating new one`);
          configObj = {};
        }
        
        // Backup existing config
        const backupPath = `${globalPath}.backup.${Date.now()}`;
        fs.copyFileSync(globalPath, backupPath);
        if (this.verbose) console.log(`     Backup created: ${backupPath}`);
      }

      // Check if already configured
      const existingServers = Array.isArray(configObj.mcpServers) ? configObj.mcpServers : [];
      const found = existingServers.find(s => {
        if (!s) return false;
        if (s.name && typeof s.name === 'string' && s.name.toLowerCase().includes('context')) return true;
        if (s.command && typeof s.command === 'string' && (s.command.includes('context-sync') || 
            (Array.isArray(s.args) && s.args.some(arg => typeof arg === 'string' && arg.includes('context-sync'))))) {
          return true;
        }
        return false;
      });

      if (found) {
        if (this.verbose) console.log(`     Already configured in global config`);
        return { success: false, reason: 'Already configured' };
      }

      // Use globalStructure or default
      const newEntry = configInfo.globalStructure || configInfo.structure || {
        name: 'Context Sync',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@context-sync/server'],
        env: {}
      };

      // Process template
      const processed = this.processTemplate(newEntry, this.packagePath);

      // Ensure mcpServers array exists
      if (!Array.isArray(configObj.mcpServers)) {
        configObj.mcpServers = [];
      }

      // Add new entry
      configObj.mcpServers.push(processed);

      // Write updated config
      const yamlText = yaml.dump(configObj, { noRefs: true, sortKeys: false });
      fs.writeFileSync(globalPath, yamlText, 'utf8');
      if (this.verbose) console.log(`     Updated global config: ${globalPath}`);
      return { success: true, path: globalPath, type: 'global' };
    } catch (error) {
      return { success: false, reason: `Error writing global config: ${error.message}` };
    }
  }

  /**
   * YAML serializer using js-yaml for robust output.
   */
  objectToYaml(obj) {
    try {
      return yaml.dump(obj, { noRefs: true, sortKeys: false });
    } catch (e) {
      // Fallback to a minimal JSON-to-YAML style string if yaml.dump fails
      return JSON.stringify(obj, null, 2) + '\n';
    }
  }

  /**
   * Process template strings, replacing {{packagePath}} with actual path
   */
  processTemplate(template, packagePath) {
    const processed = JSON.parse(JSON.stringify(template));
    
    const processObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace('{{packagePath}}', packagePath);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          processObject(obj[key]);
        } else if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map(item => 
            typeof item === 'string' ? item.replace('{{packagePath}}', packagePath) : item
          );
        }
      }
    };

    processObject(processed);
    return processed;
  }

  /**
   * Deep merge two configuration objects
   */
  mergeConfigs(existing, newConfig) {
    const result = { ...existing };

    for (const key in newConfig) {
      if (typeof newConfig[key] === 'object' && newConfig[key] !== null && !Array.isArray(newConfig[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, newConfig[key]);
      } else {
        result[key] = newConfig[key];
      }
    }

    return result;
  }

  /**
   * Check if context-sync is already configured
   */
  findContextSyncConfig(config) {
    const search = (obj, path = '') => {
      for (const key in obj) {
        if (key === 'context-sync') {
          return `${path}.${key}`;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const found = search(obj[key], `${path}.${key}`);
          if (found) return found;
        }
      }
      return null;
    };

    return search(config);
  }

  /**
   * Generate summary report
   */
  generateReport() {
    const { detected, configured, skipped, errors } = this.results;
    
    let report = '\n🎉 Auto-Configuration Complete!\n\n';
    
    report += `📊 Summary:\n`;
    report += `   • Platforms detected: ${detected.length}\n`;
    report += `   • Successfully configured: ${configured.length}\n`;
    report += `   • Skipped: ${skipped.length}\n`;
    report += `   • Errors: ${errors.length}\n\n`;

    if (configured.length > 0) {
      report += `✅ Configured Platforms:\n`;
      configured.forEach(platform => {
        const config = PLATFORM_CONFIGS[platform];
        report += `   • ${config.name}\n`;
      });
      report += '\n';
    }

    if (skipped.length > 0) {
      report += `⚠️  Skipped Platforms:\n`;
      skipped.forEach(({ platform, reason }) => {
        const config = PLATFORM_CONFIGS[platform];
        report += `   • ${config.name}: ${reason}\n`;
      });
      report += '\n';
    }

    if (errors.length > 0) {
      report += `❌ Errors:\n`;
      errors.forEach(({ platform, error }) => {
        const config = PLATFORM_CONFIGS[platform];
        report += `   • ${config.name}: ${error}\n`;
      });
      report += '\n';
    }

    report += `🚀 Next Steps:\n`;
    if (configured.length > 0) {
      report += `   1. Restart your AI applications\n`;
      report += `   2. Context Sync should appear in their MCP/tools list\n`;
      report += `   3. Try: "help context-sync" in any configured platform\n\n`;
    } else {
      report += `   1. Install an AI platform that supports MCP\n`;
      report += `   2. Run: npm install -g @context-sync/server\n`;
      report += `   3. Auto-configuration will run again\n\n`;
    }

    return report;
  }
}

module.exports = PlatformAutoConfigurator;