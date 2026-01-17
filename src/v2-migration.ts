/**
 * V2 Migration Engine
 * Safely migrates v1 context data to v2 schema without data loss
 * Runs automatically on first v2 startup
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

interface MigrationResult {
  success: boolean;
  migratedTables: string[];
  recordsCopied: number;
  skipped: string[];
  errors: string[];
  backupPath?: string;
}

export class V2Migrator {
  private db: Database.Database;
  private backupDb?: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Check if migration is needed
   */
  needsMigration(): boolean {
    // Check if v1 tables have data but v2 tables are empty
    const v1HasData = this.hasV1Data();
    const v2IsEmpty = this.isV2Empty();
    
    return v1HasData && v2IsEmpty;
  }

  /**
   * Perform safe migration with backup (synchronous)
   */
  migrateSync(): MigrationResult {
    console.log('🔄 Starting v1 → v2 migration...\n');

    const result: MigrationResult = {
      success: true,
      migratedTables: [],
      recordsCopied: 0,
      skipped: [],
      errors: []
    };

    try {
      // 1. Create backup
      console.log('📦 Creating backup...');
      const backupPath = this.createBackup();
      result.backupPath = backupPath;
      console.log(`✅ Backup created: ${backupPath}\n`);

      // 2. Start transaction for atomic migration
      this.db.exec('BEGIN TRANSACTION');

      // 3. Migrate decisions → decisions (enhanced with metadata)
      console.log('📝 Migrating decisions...');
      const decisionCount = this.migrateDecisions();
      result.recordsCopied += decisionCount;
      result.migratedTables.push('decisions');
      console.log(`✅ Migrated ${decisionCount} decisions\n`);

      // 4. Migrate conversations → notes (as general context)
      console.log('💬 Migrating conversations to notes...');
      const conversationCount = this.migrateConversationsToNotes();
      result.recordsCopied += conversationCount;
      result.migratedTables.push('conversations → notes');
      console.log(`✅ Migrated ${conversationCount} conversations\n`);

      // 5. Migrate learnings → notes (as insights)
      console.log('💡 Migrating learnings to notes...');
      const learningCount = this.migrateLearningsToNotes();
      result.recordsCopied += learningCount;
      result.migratedTables.push('learnings → notes');
      console.log(`✅ Migrated ${learningCount} learnings\n`);

      // 6. Migrate problem_solutions → problems (with solutions as resolution)
      console.log('🔧 Migrating problem solutions...');
      const problemCount = this.migrateProblemSolutions();
      result.recordsCopied += problemCount;
      result.migratedTables.push('problem_solutions → problems');
      console.log(`✅ Migrated ${problemCount} problem solutions\n`);

      // 7. Migrate comparisons → decisions (as decision rationale)
      console.log('⚖️ Migrating comparisons to decisions...');
      const comparisonCount = this.migrateComparisons();
      result.recordsCopied += comparisonCount;
      result.migratedTables.push('comparisons → decisions');
      console.log(`✅ Migrated ${comparisonCount} comparisons\n`);

      // 8. Migrate anti_patterns → constraints (as "don't do this" rules)
      console.log('🚫 Migrating anti-patterns to constraints...');
      const antiPatternCount = this.migrateAntiPatterns();
      result.recordsCopied += antiPatternCount;
      result.migratedTables.push('anti_patterns → constraints');
      console.log(`✅ Migrated ${antiPatternCount} anti-patterns\n`);

      // 9. Migrate todos → active_work (with status mapping)
      console.log('✅ Migrating todos to active work...');
      const todoCount = this.migrateTodos();
      result.recordsCopied += todoCount;
      result.migratedTables.push('todos → active_work');
      console.log(`✅ Migrated ${todoCount} todos\n`);

      // 10. Commit transaction
      this.db.exec('COMMIT');

      // 10. Mark migration as complete
      this.markMigrationComplete();

      console.log('✅ Migration completed successfully!');
      console.log(`📊 Total records migrated: ${result.recordsCopied}`);
      console.log(`💾 Backup available at: ${backupPath}\n`);

      return result;

    } catch (error: any) {
      // Rollback on error
      try {
        this.db.exec('ROLLBACK');
      } catch {}

      result.success = false;
      result.errors.push(error.message);
      console.error('❌ Migration failed:', error.message);
      
      return result;
    }
  }

  /**
   * Perform safe migration with backup (async for compatibility)
   */
  async migrate(): Promise<MigrationResult> {
    return this.migrateSync();
  }

  /**
   * Create database backup before migration
   */
  private createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = this.db.name.replace('.db', `.v1-backup-${timestamp}.db`);
    
    // Use SQLite backup API for safe copy
    this.backupDb = new Database(backupPath);
    this.db.backup(backupPath);
    
    return backupPath;
  }

  /**
   * Check if v1 tables have data
   */
  private hasV1Data(): boolean {
    const v1Tables = ['decisions', 'conversations', 'learnings', 'problem_solutions', 'comparisons', 'anti_patterns', 'todos'];
    
    for (const table of v1Tables) {
      try {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        if (result.count > 0) {
          return true;
        }
      } catch {
        // Table doesn't exist, skip
        continue;
      }
    }
    
    return false;
  }

  /**
   * Check if v2 tables are empty (fresh install or needs migration)
   */
  private isV2Empty(): boolean {
    const v2Tables = ['active_work', 'constraints', 'problems', 'goals', 'notes'];
    
    for (const table of v2Tables) {
      try {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        if (result.count > 0) {
          return false; // v2 already has data
        }
      } catch {
        // Table doesn't exist
        return true;
      }
    }
    
    return true;
  }

  /**
   * Migrate decisions (v1 → v2 schema is compatible, just enhance)
   */
  private migrateDecisions(): number {
    // V1 decisions table structure: id, project_id, type, description, reasoning, timestamp
    // V2 decisions table is the same, no changes needed
    // But we can check if any decisions exist and are already in the right format
    
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM decisions').get() as { count: number };
    return existing.count;
  }

  /**
   * Migrate conversations to notes
   */
  private migrateConversationsToNotes(): number {
    const conversations = this.db.prepare(`
      SELECT * FROM conversations 
      ORDER BY timestamp DESC
    `).all();

    let count = 0;
    const insertNote = this.db.prepare(`
      INSERT INTO notes (id, project_id, content, tags, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const conv of conversations as any[]) {
      const content = `[${conv.tool}] ${conv.role}: ${conv.content}`;
      const tags = JSON.stringify(['conversation', conv.tool, conv.role]);
      
      insertNote.run(
        randomUUID(),
        conv.project_id,
        content,
        tags,
        conv.timestamp
      );
      count++;
    }

    return count;
  }

  /**
   * Migrate learnings to notes
   */
  private migrateLearningsToNotes(): number {
    const learnings = this.db.prepare(`
      SELECT * FROM learnings 
      ORDER BY timestamp DESC
    `).all();

    let count = 0;
    const insertNote = this.db.prepare(`
      INSERT INTO notes (id, project_id, content, tags, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const learning of learnings as any[]) {
      const content = `💡 ${learning.insight}${learning.context ? `\n\nContext: ${learning.context}` : ''}`;
      const tags = JSON.stringify(['learning', 'insight', `confidence-${learning.confidence || 'medium'}`]);
      
      insertNote.run(
        randomUUID(),
        learning.project_id,
        content,
        tags,
        learning.timestamp
      );
      count++;
    }

    return count;
  }

  /**
   * Migrate problem_solutions to problems
   */
  private migrateProblemSolutions(): number {
    const problemSolutions = this.db.prepare(`
      SELECT * FROM problem_solutions 
      ORDER BY timestamp DESC
    `).all();

    let count = 0;
    const insertProblem = this.db.prepare(`
      INSERT INTO problems (id, project_id, description, context, status, resolution, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ps of problemSolutions as any[]) {
      insertProblem.run(
        randomUUID(),
        ps.project_id,
        ps.problem,
        `Confidence: ${ps.confidence || 'medium'}`,
        'resolved', // All historical problems are resolved
        ps.solution,
        ps.timestamp
      );
      count++;
    }

    return count;
  }

  /**
   * Migrate comparisons to decisions
   */
  private migrateComparisons(): number {
    const comparisons = this.db.prepare(`
      SELECT * FROM comparisons 
      ORDER BY timestamp DESC
    `).all();

    let count = 0;
    const insertDecision = this.db.prepare(`
      INSERT INTO decisions (id, project_id, type, description, reasoning, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const comp of comparisons as any[]) {
      const description = `Chose ${comp.winner || comp.option_a} over ${comp.option_a === comp.winner ? comp.option_b : comp.option_a}`;
      const reasoning = JSON.stringify({
        comparison: {
          optionA: comp.option_a,
          optionB: comp.option_b,
          winner: comp.winner,
          reasoning: comp.reasoning,
          confidence: comp.confidence
        }
      });
      
      insertDecision.run(
        randomUUID(),
        comp.project_id,
        'comparison',
        description,
        reasoning,
        comp.timestamp
      );
      count++;
    }

    return count;
  }

  /**
   * Migrate anti_patterns to constraints
   */
  private migrateAntiPatterns(): number {
    const antiPatterns = this.db.prepare(`
      SELECT * FROM anti_patterns 
      ORDER BY timestamp DESC
    `).all();

    let count = 0;
    const insertConstraint = this.db.prepare(`
      INSERT INTO constraints (id, project_id, key, value, reasoning, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const ap of antiPatterns as any[]) {
      const key = `avoid-${ap.description.substring(0, 50).replace(/\s+/g, '-').toLowerCase()}`;
      const value = `DON'T: ${ap.description}`;
      
      insertConstraint.run(
        randomUUID(),
        ap.project_id,
        key,
        value,
        ap.why,
        ap.timestamp
      );
      count++;
    }

    return count;
  }

  /**
   * Migrate todos to active_work
   * Maps todo statuses: pending/in_progress → active, completed → completed
   */
  private migrateTodos(): number {
    // Check if todos table exists
    try {
      this.db.prepare('SELECT COUNT(*) FROM todos LIMIT 1').get();
    } catch {
      // Table doesn't exist, skip migration
      return 0;
    }

    const todos = this.db.prepare(`
      SELECT * FROM todos 
      ORDER BY created_at DESC
    `).all();

    let count = 0;
    const insertActiveWork = this.db.prepare(`
      INSERT INTO active_work (id, project_id, task, context, files, branch, timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const todo of todos as any[]) {
      // Map todo status to active_work status
      let status: 'active' | 'paused' | 'completed' = 'active';
      if (todo.status === 'completed' || todo.status === 'done') {
        status = 'completed';
      } else if (todo.status === 'blocked' || todo.status === 'on_hold') {
        status = 'paused';
      }

      // Build context from todo description and metadata
      const contextParts = [];
      if (todo.description) contextParts.push(todo.description);
      if (todo.priority) contextParts.push(`Priority: ${todo.priority}`);
      if (todo.due_date) contextParts.push(`Due: ${todo.due_date}`);
      if (todo.tags) {
        try {
          const tags = JSON.parse(todo.tags);
          if (tags.length > 0) contextParts.push(`Tags: ${tags.join(', ')}`);
        } catch {}
      }
      const context = contextParts.join('\n');

      // Convert timestamp from ISO string to epoch
      const timestamp = todo.created_at ? new Date(todo.created_at).getTime() : Date.now();

      insertActiveWork.run(
        randomUUID(),
        todo.project_id,
        todo.title,
        context || null,
        null, // files - todos didn't have this
        null, // branch - todos didn't have this
        timestamp,
        status
      );
      count++;
    }

    return count;
  }

  /**
   * Mark migration as complete in database
   */
  private markMigrationComplete(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        completed_at INTEGER NOT NULL
      );
      
      INSERT INTO migration_history (id, version, completed_at)
      VALUES ('v1-to-v2', '2.0.0', ${Date.now()});
    `);
  }

  /**
   * Check if migration has been completed before
   */
  static hasCompletedMigration(db: Database.Database): boolean {
    try {
      const result = db.prepare(`
        SELECT * FROM migration_history 
        WHERE version = '2.0.0'
      `).get();
      
      return !!result;
    } catch {
      return false;
    }
  }
}
