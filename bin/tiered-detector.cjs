/**
 * Tiered Platform Detection System
 * 
 * Uses existing working detection as primary, with enhanced detection as fallback.
 * This ensures we don't break current functionality while adding robustness.
 */

const PLATFORM_CONFIGS = require('./platform-configs.cjs');
const EnhancedDetector = require('./enhanced-detector.cjs');

class TieredPlatformDetector {
  constructor() {
    this.enhancedDetector = new EnhancedDetector();
  }

  /**
   * Tiered detection: Current method first, enhanced as fallback
   */
  async detectPlatform(platformId, config) {
    // Tier 1: Use existing working detection (current implementation)
    const primaryResult = await this.detectWithCurrentMethod(platformId, config);
    if (primaryResult) {
      return { ...primaryResult, tier: 'primary', reliable: true };
    }

    // Tier 2: Enhanced detection as fallback
    console.log(`   📡 Primary detection failed, trying enhanced methods...`);
    const enhancedResult = await this.enhancedDetector.detectPlatform(platformId, config);
    if (enhancedResult) {
      return { ...enhancedResult, tier: 'enhanced', reliable: false };
    }

    return null;
  }

  /**
   * Current detection method (proven to work on Windows)
   */
  async detectWithCurrentMethod(platformId, config) {
    const detection = config.detection;
    
    // Method 1: Check file system paths (current working approach)
    if (detection.paths && detection.paths[process.platform]) {
      const paths = detection.paths[process.platform];
      for (const checkPath of paths) {
        if (require('fs').existsSync(checkPath)) {
          return { path: checkPath, method: 'filesystem-primary' };
        }
      }
    }

    // Method 2: Check for VS Code extensions (current working approach)
    if (detection.extensionId || detection.extensionCheck) {
      const extensionResult = await this.checkVSCodeExtension(platformId, detection);
      if (extensionResult) {
        return { path: extensionResult, method: 'extension-primary' };
      }
    }

    // Method 3: Check command availability (current working approach)
    if (detection.command) {
      try {
        require('child_process').execSync(detection.command, { stdio: 'ignore' });
        return { path: detection.command, method: 'command-primary' };
      } catch (error) {
        // Command not available
      }
    }

    return null;
  }

  /**
   * VS Code extension check (from current working implementation)
   */
  async checkVSCodeExtension(platformId, detection) {
    const fs = require('fs');
    let extensionsPath;
    
    if (detection.extensionCheck) {
      extensionsPath = detection.extensionCheck[process.platform];
    } else if (detection.paths) {
      extensionsPath = detection.paths[process.platform];
    }

    if (!extensionsPath || !fs.existsSync(extensionsPath)) {
      return false;
    }

    try {
      const extensions = fs.readdirSync(extensionsPath);
      
      // Look for specific extension ID
      if (detection.extensionId) {
        return extensions.some(ext => ext.startsWith(detection.extensionId));
      }

      // For Copilot, look for github.copilot extension
      if (platformId === 'copilot') {
        return extensions.some(ext => 
          ext.includes('github.copilot') || ext.includes('copilot')
        );
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = TieredPlatformDetector;