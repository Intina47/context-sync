import { DatabaseMigrator } from './database-migrator.js';
import type { ProjectContext } from './types.js';

export interface MigrationPromptResult {
  shouldPrompt: boolean;
  message: string;
  duplicateCount: number;
  hasPromptedThisSession?: boolean;
}

export class MigrationPrompter {
  private static sessionPrompts: Set<string> = new Set();
  private static readonly VERSION_REQUIRING_MIGRATION = '1.0.0';

  /**
   * Check if we should prompt the user for database migration
   */
  static async shouldPromptForMigration(
    currentVersion: string,
    dbPath?: string
  ): Promise<MigrationPromptResult> {
    // Only prompt for v1.0.0+
    if (!this.isVersionRequiringMigration(currentVersion)) {
      return {
        shouldPrompt: false,
        message: '',
        duplicateCount: 0
      };
    }

    // Check if already prompted this session
    const sessionKey = `migration_${dbPath || 'default'}`;
    if (this.sessionPrompts.has(sessionKey)) {
      return {
        shouldPrompt: false,
        message: '',
        duplicateCount: 0,
        hasPromptedThisSession: true
      };
    }

    try {
      // Check for duplicates
      const migrator = new DatabaseMigrator(dbPath);
      const stats = await migrator.getMigrationStats();
      migrator.close();

      if (stats.duplicateGroups === 0) {
        return {
          shouldPrompt: false,
          message: '',
          duplicateCount: 0
        };
      }

      // Mark as prompted for this session
      this.sessionPrompts.add(sessionKey);

      const message = this.buildMigrationPromptMessage(stats);

      return {
        shouldPrompt: true,
        message,
        duplicateCount: stats.totalDuplicates,
        hasPromptedThisSession: false
      };

    } catch (error) {
      console.warn('Failed to check migration status:', error);
      return {
        shouldPrompt: false,
        message: '',
        duplicateCount: 0
      };
    }
  }

  /**
   * Check if current version requires migration prompting
   */
  private static isVersionRequiringMigration(version: string): boolean {
    try {
      const current = this.parseVersion(version);
      const required = this.parseVersion(this.VERSION_REQUIRING_MIGRATION);
      
      return current.major >= required.major && 
             (current.major > required.major || current.minor >= required.minor);
    } catch {
      return false; // If we can't parse version, don't prompt
    }
  }

  /**
   * Parse semantic version string
   */
  private static parseVersion(version: string): { major: number; minor: number; patch: number } {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }
    
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }

  /**
   * Build user-friendly migration prompt message
   */
  private static buildMigrationPromptMessage(stats: any): string {
    let message = `🔧 **Context Sync v1.0.0+ Database Optimization Available**\n\n`;
    
    message += `Your database has **${stats.totalDuplicates} duplicate projects** that can be cleaned up for better performance.\n\n`;
    
    message += `✨ **Benefits of running migration:**\n`;
    message += `• 🚀 **Faster performance** - Optimized database operations\n`;
    message += `• 🧹 **Cleaner project list** - Remove duplicate entries\n`;
    message += `• 🎯 **Better AI integration** - Improved context accuracy\n`;
    message += `• 💾 **Preserved data** - All conversations, decisions, and todos kept safe\n\n`;
    
    message += `📋 **What will be cleaned:**\n`;
    stats.duplicateDetails.slice(0, 3).forEach((group: any, i: number) => {
      message += `• ${group.path} (${group.count} duplicates)\n`;
    });
    
    if (stats.duplicateDetails.length > 3) {
      message += `• ... and ${stats.duplicateDetails.length - 3} more duplicate groups\n`;
    }
    
    message += `\n🛡️  **Safe & Reversible:**\n`;
    message += `• Preview changes first: \`migrate_database dryRun:true\`\n`;
    message += `• Full backup recommended before migration\n`;
    message += `• All your project data will be preserved and merged\n\n`;
    
    message += `🚀 **Ready to optimize?**\n`;
    message += `1. Preview: \`get_migration_stats\`\n`;
    message += `2. Test run: \`migrate_database dryRun:true\`\n`;
    message += `3. Apply: \`migrate_database\`\n\n`;
    
    message += `*This message shows once per session. Migration is optional but recommended for optimal performance.*`;
    
    return message;
  }

  /**
   * Create a lightweight migration suggestion message
   */
  static createLightweightPrompt(duplicateCount: number): string {
    return `💡 **Performance Tip:** Your database has ${duplicateCount} duplicate projects. ` +
           `Run \`get_migration_stats\` to see cleanup options for better performance.`;
  }

  /**
   * Reset session prompts (useful for testing)
   */
  static resetSessionPrompts(): void {
    this.sessionPrompts.clear();
  }

  /**
   * Check if a specific migration has been prompted this session
   */
  static hasPromptedThisSession(dbPath?: string): boolean {
    const sessionKey = `migration_${dbPath || 'default'}`;
    return this.sessionPrompts.has(sessionKey);
  }
}