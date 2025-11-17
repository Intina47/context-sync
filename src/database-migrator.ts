// Database migration and cleanup tools
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import { PathNormalizer } from './path-normalizer.js';

export interface MigrationResult {
  success: boolean;
  duplicatesFound: number;
  duplicatesRemoved: number;
  projectsMerged: number;
  errors: string[];
  details: string[];
}

export class DatabaseMigrator {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(os.homedir(), '.context-sync', 'data.db');
    const actualPath = dbPath || defaultPath;
    this.db = new Database(actualPath);
  }

  /**
   * Migrate and merge duplicate projects by normalized path
   */
  async migrateDuplicateProjects(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      projectsMerged: 0,
      errors: [],
      details: []
    };

    try {
      // Begin transaction for safety
      this.db.exec('BEGIN TRANSACTION');

      // Find all projects grouped by normalized path
      const projects = this.db.prepare(`
        SELECT id, name, path, created_at, updated_at, architecture, tech_stack
        FROM projects 
        WHERE path IS NOT NULL
        ORDER BY path, created_at ASC
      `).all() as any[];

      // Group by normalized path
      const pathGroups: Map<string, any[]> = new Map();
      
      for (const project of projects) {
        const normalizedPath = PathNormalizer.normalize(project.path);
        if (!pathGroups.has(normalizedPath)) {
          pathGroups.set(normalizedPath, []);
        }
        pathGroups.get(normalizedPath)!.push(project);
      }

      // Process each group and merge duplicates
      for (const [normalizedPath, projectGroup] of pathGroups.entries()) {
        if (projectGroup.length <= 1) continue; // No duplicates

        result.duplicatesFound += projectGroup.length - 1;
        result.details.push(`Found ${projectGroup.length} duplicates for path: ${normalizedPath}`);

        // Sort by updated_at DESC to keep the most recently updated project
        projectGroup.sort((a, b) => b.updated_at - a.updated_at);
        const keepProject = projectGroup[0];
        const removeProjects = projectGroup.slice(1);

        // Update the keeper with best metadata
        const bestName = this.chooseBestProjectName(projectGroup, normalizedPath);
        const mergedTechStack = this.mergeTechStacks(projectGroup);
        const bestArchitecture = this.chooseBestArchitecture(projectGroup);

        // Update the project we're keeping
        this.db.prepare(`
          UPDATE projects 
          SET name = ?, architecture = ?, tech_stack = ?, updated_at = ?
          WHERE id = ?
        `).run(
          bestName,
          bestArchitecture,
          mergedTechStack ? JSON.stringify(mergedTechStack) : null,
          Date.now(),
          keepProject.id
        );

        // Migrate conversations and decisions to the keeper
        for (const removeProject of removeProjects) {
          // Update conversations
          const conversationCount = this.db.prepare(`
            UPDATE conversations SET project_id = ? WHERE project_id = ?
          `).run(keepProject.id, removeProject.id).changes;

          // Update decisions
          const decisionCount = this.db.prepare(`
            UPDATE decisions SET project_id = ? WHERE project_id = ?
          `).run(keepProject.id, removeProject.id).changes;

          // Update todos
          const todoCount = this.db.prepare(`
            UPDATE todos SET project_id = ? WHERE project_id = ?
          `).run(keepProject.id, removeProject.id).changes;

          result.details.push(
            `Merged project ${removeProject.name} (${removeProject.id.substring(0, 8)}): ` +
            `${conversationCount} conversations, ${decisionCount} decisions, ${todoCount} todos`
          );

          // Delete the duplicate project
          this.db.prepare('DELETE FROM projects WHERE id = ?').run(removeProject.id);
          result.duplicatesRemoved++;
        }

        result.projectsMerged++;
        result.details.push(`Kept project: ${keepProject.name} (${keepProject.id.substring(0, 8)})`);
      }

      // Commit transaction
      this.db.exec('COMMIT');
      result.success = true;

      result.details.push(`\n✅ Migration completed successfully!`);
      result.details.push(`📊 Summary: ${result.duplicatesRemoved} duplicates removed, ${result.projectsMerged} projects merged`);

    } catch (error) {
      // Rollback on error
      this.db.exec('ROLLBACK');
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Choose the best project name from duplicates (prefer folder name)
   */
  private chooseBestProjectName(projects: any[], normalizedPath: string): string {
    const folderName = path.basename(normalizedPath);
    
    // Prefer the folder name if any project has it
    const folderNameProject = projects.find(p => p.name === folderName);
    if (folderNameProject) return folderName;
    
    // Otherwise prefer names that don't start with @ (package names)
    const nonPackageNames = projects.filter(p => !p.name.startsWith('@'));
    if (nonPackageNames.length > 0) {
      return nonPackageNames[0].name;
    }
    
    // Fallback to most recent project name
    return projects[0].name;
  }

  /**
   * Merge tech stacks from duplicate projects
   */
  private mergeTechStacks(projects: any[]): string[] | null {
    const allTechStacks: string[] = [];
    
    for (const project of projects) {
      if (project.tech_stack) {
        try {
          const techStack = JSON.parse(project.tech_stack);
          if (Array.isArray(techStack)) {
            allTechStacks.push(...techStack);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
    
    // Return unique tech stack items
    const uniqueTechStack = [...new Set(allTechStacks)];
    return uniqueTechStack.length > 0 ? uniqueTechStack : null;
  }

  /**
   * Choose the best architecture from duplicates
   */
  private chooseBestArchitecture(projects: any[]): string | null {
    // Find the most specific architecture
    const architectures = projects
      .map(p => p.architecture)
      .filter(arch => arch && arch !== 'Not specified');
    
    return architectures[0] || null;
  }

  /**
   * Get migration statistics without running the migration
   */
  async getMigrationStats(): Promise<{
    totalProjects: number;
    projectsWithPaths: number;
    duplicateGroups: number;
    totalDuplicates: number;
    duplicateDetails: Array<{ path: string; count: number; names: string[] }>;
  }> {
    const projects = this.db.prepare(`
      SELECT id, name, path 
      FROM projects 
      WHERE path IS NOT NULL
    `).all() as any[];

    const pathGroups: Map<string, any[]> = new Map();
    
    for (const project of projects) {
      const normalizedPath = PathNormalizer.normalize(project.path);
      if (!pathGroups.has(normalizedPath)) {
        pathGroups.set(normalizedPath, []);
      }
      pathGroups.get(normalizedPath)!.push(project);
    }

    const duplicateGroups = Array.from(pathGroups.entries())
      .filter(([_, group]) => group.length > 1);

    const totalDuplicates = duplicateGroups.reduce((sum, [_, group]) => sum + (group.length - 1), 0);

    const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };

    return {
      totalProjects: totalCount.count,
      projectsWithPaths: projects.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicates,
      duplicateDetails: duplicateGroups.map(([path, group]) => ({
        path,
        count: group.length,
        names: group.map(p => p.name)
      }))
    };
  }

  close(): void {
    this.db.close();
  }
}