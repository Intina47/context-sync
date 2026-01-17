import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type {
  ProjectContext,
  Conversation,
  Decision,
  Learning,
  ProblemSolution,
  Comparison,
  AntiPattern,
  ContextSummary,
  StorageInterface,
} from './types.js';
import {createTodoTable} from './todo-schema.js';
import { PathNormalizer } from './path-normalizer.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { MigrationPrompter } from './migration-prompter.js';
import { migrateToV2, isV2Schema } from './schema-v2.js';

export class Storage implements StorageInterface {
  private db: Database.Database;
  
  // Prepared statement cache for 2-5x faster queries with LRU eviction
  private preparedStatements: Map<string, Database.Statement> = new Map();
  private readonly MAX_PREPARED_STATEMENTS = 100;

  constructor(dbPath?: string) {
    // Default to user's home directory
    const defaultPath = path.join(os.homedir(), '.context-sync', 'data.db');
    const actualPath = dbPath || defaultPath;
    
    // Ensure directory exists
    const dir = path.dirname(actualPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(actualPath);
    this.initDatabase();
    createTodoTable(this.db);
    
    // Migrate to v2 schema if needed
    if (!isV2Schema(this.db)) {
      migrateToV2(this.db);
    }
  }

  private initDatabase(): void {
    
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT,
        architecture TEXT,
        tech_stack TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_current INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        reasoning TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS learnings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        insight TEXT NOT NULL,
        context TEXT,
        confidence REAL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS problem_solutions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        confidence REAL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS comparisons (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        winner TEXT,
        reasoning TEXT,
        confidence REAL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS anti_patterns (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        description TEXT NOT NULL,
        why TEXT NOT NULL,
        confidence REAL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_project 
        ON conversations(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_decisions_project 
        ON decisions(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_learnings_project 
        ON learnings(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_problem_solutions_project 
        ON problem_solutions(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_comparisons_project 
        ON comparisons(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_anti_patterns_project 
        ON anti_patterns(project_id, timestamp DESC);
    `);
  }

  /**
   * Get or create a prepared statement for faster queries (2-5x performance improvement)
   * Implements LRU cache to prevent memory bloat
   */
  private getStatement(sql: string): Database.Statement {
    if (this.preparedStatements.has(sql)) {
      // Move to end (most recently used) in Map
      const statement = this.preparedStatements.get(sql)!;
      this.preparedStatements.delete(sql);
      this.preparedStatements.set(sql, statement);
      return statement;
    }
    
    // Check if we need to evict oldest entry
    if (this.preparedStatements.size >= this.MAX_PREPARED_STATEMENTS) {
      // Remove least recently used (first entry in Map)
      const firstKey = this.preparedStatements.keys().next().value;
      if (firstKey) {
        const oldStatement = this.preparedStatements.get(firstKey);
        this.preparedStatements.delete(firstKey);
        
        // Note: better-sqlite3 statements don't need explicit cleanup
        // They are automatically cleaned up when garbage collected
      }
    }
    
    const statement = this.db.prepare(sql);
    this.preparedStatements.set(sql, statement);
    return statement;
  }

    createProject(name: string, projectPath?: string): ProjectContext {
    const timer = PerformanceMonitor.startTimer('createProject');
    
    // Normalize the path before storing if provided
    const normalizedPath = projectPath ? PathNormalizer.normalize(projectPath) : undefined;
    
    // Check for existing project with same path to prevent duplicates
    if (normalizedPath) {
      const existing = this.findProjectByPath(normalizedPath);
      if (existing) {
        timer();
        return existing;
      }
    }
    
    const id = crypto.randomUUID();
    const now = Date.now();

    this.getStatement(`
      INSERT INTO projects (id, name, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, normalizedPath, now, now);

    timer();

    return {
      id,
      name,
      path: normalizedPath,
      techStack: [],
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  getProject(id: string): ProjectContext | null {
    const row = this.getStatement(`
      SELECT * FROM projects WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    return this.rowToProject(row);
  }

  /**
   * @deprecated This method is deprecated. Use ContextSyncServer.getCurrentProject() instead.
   * Current project is now managed as session state, not in database.
   */
  getCurrentProject(): ProjectContext | null {
    // Return null - current project should be retrieved from session
    return null;
  }
  /**
   * @deprecated This method is deprecated. Current project is now managed as session state in ContextSyncServer.
   * Kept for backward compatibility only.
   */
  setCurrentProject(projectId: string): void {
    // No-op - current project is now managed in ContextSyncServer
  }


  updateProject(id: string, updates: Partial<ProjectContext>): void {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.architecture) {
      sets.push('architecture = ?');
      values.push(updates.architecture);
    }
    if (updates.techStack) {
      sets.push('tech_stack = ?');
      values.push(JSON.stringify(updates.techStack));
    }

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.getStatement(`
      UPDATE projects SET ${sets.join(', ')} WHERE id = ?
    `).run(...values);
  }

  addConversation(conv: Omit<Conversation, 'id' | 'timestamp'>): Conversation {
    const id = randomUUID();
    const timestamp = Date.now();

    this.getStatement(`
      INSERT INTO conversations (id, project_id, tool, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      conv.projectId,
      conv.tool,
      conv.role,
      conv.content,
      timestamp,
      conv.metadata ? JSON.stringify(conv.metadata) : null
    );

    return {
      id,
      ...conv,
      timestamp: new Date(timestamp),
    };
  }

  findProjectByPath(projectPath: string): ProjectContext | null {
    const timer = PerformanceMonitor.startTimer('findProjectByPath');
    
    // Normalize the input path for consistent lookup
    const normalizedPath = PathNormalizer.normalize(projectPath);
    
    const row = this.getStatement(`
      SELECT * FROM projects WHERE path = ?
    `).get(normalizedPath) as any;

    timer();

    if (!row) return null;

    return this.rowToProject(row);
  }

  getRecentConversations(projectId: string, limit: number = 10): Conversation[] {
    const rows = this.getStatement(`
      SELECT * FROM conversations 
      WHERE project_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      tool: row.tool,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  addDecision(decision: Omit<Decision, 'id' | 'timestamp'>): Decision {
    const id = randomUUID();
    const timestamp = Date.now();

    this.getStatement(`
      INSERT INTO decisions (id, project_id, type, description, reasoning, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      decision.projectId,
      decision.type,
      decision.description,
      decision.reasoning || null,
      timestamp
    );

    return {
      id,
      ...decision,
      timestamp: new Date(timestamp),
    };
  }

  getDecisions(projectId: string): Decision[] {
    const rows = this.getStatement(`
      SELECT * FROM decisions 
      WHERE project_id = ? 
      ORDER BY timestamp DESC
    `).all(projectId) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      description: row.description,
      reasoning: row.reasoning,
      timestamp: new Date(row.timestamp),
    }));
  }

  /**
   * Stream conversations one at a time for memory efficiency
   * Use when processing large result sets (>100 rows)
   * 
   * Usage examples:
   * 
   * // Process all conversations lazily (low memory)
   * for (const conv of storage.streamConversations(projectId)) {
   *   console.log(conv.content);
   * }
   * 
   * // Take first 10 efficiently
   * const first10 = Storage.take(storage.streamConversations(projectId), 10);
   * 
   * // Filter + map (lazy, no intermediate arrays)
   * const userMessages = Storage.filter(
   *   storage.streamConversations(projectId),
   *   c => c.role === 'user'
   * );
   */
  *streamConversations(projectId: string, limit?: number): Generator<Conversation> {
    const sql = limit 
      ? `SELECT * FROM conversations WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM conversations WHERE project_id = ? ORDER BY timestamp DESC`;
    
    const stmt = this.getStatement(sql);
    const iterator = limit ? stmt.iterate(projectId, limit) : stmt.iterate(projectId);
    
    for (const row of iterator as any) {
      yield {
        id: row.id,
        projectId: row.project_id,
        tool: row.tool,
        role: row.role,
        content: row.content,
        timestamp: new Date(row.timestamp),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };
    }
  }

  /**
   * Stream decisions one at a time for memory efficiency
   * Use when processing large result sets (>100 rows)
   */
  *streamDecisions(projectId: string, limit?: number): Generator<Decision> {
    const sql = limit
      ? `SELECT * FROM decisions WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM decisions WHERE project_id = ? ORDER BY timestamp DESC`;
    
    const stmt = this.getStatement(sql);
    const iterator = limit ? stmt.iterate(projectId, limit) : stmt.iterate(projectId);
    
    for (const row of iterator as any) {
      yield {
        id: row.id,
        projectId: row.project_id,
        type: row.type,
        description: row.description,
        reasoning: row.reasoning,
        timestamp: new Date(row.timestamp),
      };
    }
  }

  /**
   * Stream all projects one at a time for memory efficiency
   * Useful for bulk operations across many projects
   */
  *streamAllProjects(): Generator<ProjectContext> {
    const stmt = this.getStatement(`
      SELECT * FROM projects ORDER BY updated_at DESC
    `);
    
    for (const row of stmt.iterate() as any) {
      yield this.rowToProject(row);
    }
  }

  // ========== NEW CONTEXT TYPES ==========

  addLearning(learning: Omit<Learning, 'id' | 'timestamp'>): Learning {
    const id = randomUUID();
    const timestamp = Date.now();

    this.getStatement(`
      INSERT INTO learnings (id, project_id, insight, context, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      learning.projectId,
      learning.insight,
      learning.context || null,
      learning.confidence || null,
      timestamp
    );

    return {
      id,
      ...learning,
      timestamp: new Date(timestamp),
    };
  }

  getLearnings(projectId: string, limit: number = 50): Learning[] {
    const rows = this.getStatement(`
      SELECT * FROM learnings 
      WHERE project_id = ? 
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      insight: row.insight,
      context: row.context,
      confidence: row.confidence,
      timestamp: new Date(row.timestamp),
    }));
  }

  addProblemSolution(problem: Omit<ProblemSolution, 'id' | 'timestamp'>): ProblemSolution {
    const id = randomUUID();
    const timestamp = Date.now();

    this.getStatement(`
      INSERT INTO problem_solutions (id, project_id, problem, solution, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      problem.projectId,
      problem.problem,
      problem.solution,
      problem.confidence || null,
      timestamp
    );

    return {
      id,
      ...problem,
      timestamp: new Date(timestamp),
    };
  }

  getProblemSolutions(projectId: string, limit: number = 50): ProblemSolution[] {
    const rows = this.getStatement(`
      SELECT * FROM problem_solutions 
      WHERE project_id = ? 
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      problem: row.problem,
      solution: row.solution,
      confidence: row.confidence,
      timestamp: new Date(row.timestamp),
    }));
  }

  addComparison(comparison: Omit<Comparison, 'id' | 'timestamp'>): Comparison {
    const id = randomUUID();
    const timestamp = Date.now();

    this.getStatement(`
      INSERT INTO comparisons (id, project_id, option_a, option_b, winner, reasoning, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      comparison.projectId,
      comparison.optionA,
      comparison.optionB,
      comparison.winner || null,
      comparison.reasoning || null,
      comparison.confidence || null,
      timestamp
    );

    return {
      id,
      ...comparison,
      timestamp: new Date(timestamp),
    };
  }

  getComparisons(projectId: string, limit: number = 50): Comparison[] {
    const rows = this.getStatement(`
      SELECT * FROM comparisons 
      WHERE project_id = ? 
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      optionA: row.option_a,
      optionB: row.option_b,
      winner: row.winner,
      reasoning: row.reasoning,
      confidence: row.confidence,
      timestamp: new Date(row.timestamp),
    }));
  }

  addAntiPattern(antiPattern: Omit<AntiPattern, 'id' | 'timestamp'>): AntiPattern {
    const id = randomUUID();
    const timestamp = Date.now();

    this.getStatement(`
      INSERT INTO anti_patterns (id, project_id, description, why, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      antiPattern.projectId,
      antiPattern.description,
      antiPattern.why,
      antiPattern.confidence || null,
      timestamp
    );

    return {
      id,
      ...antiPattern,
      timestamp: new Date(timestamp),
    };
  }

  getAntiPatterns(projectId: string, limit: number = 50): AntiPattern[] {
    const rows = this.getStatement(`
      SELECT * FROM anti_patterns 
      WHERE project_id = ? 
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      description: row.description,
      why: row.why,
      confidence: row.confidence,
      timestamp: new Date(row.timestamp),
    }));
  }

  getContextSummary(projectId: string): ContextSummary {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const recentDecisions = this.getDecisions(projectId).slice(0, 5);
    const recentConversations = this.getRecentConversations(projectId, 20);

    // Extract key points from decisions
    const keyPoints = [
      project.architecture ? `Architecture: ${project.architecture}` : null,
      ...project.techStack.map(tech => `Using: ${tech}`),
      ...recentDecisions.map(d => d.description),
    ].filter(Boolean) as string[];

    return {
      project,
      recentDecisions,
      recentConversations,
      keyPoints,
    };
  }

  private rowToProject(row: any): ProjectContext {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      architecture: row.architecture,
      techStack: row.tech_stack ? JSON.parse(row.tech_stack) : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  getAllProjects(): ProjectContext[] {
    const timer = PerformanceMonitor.startTimer('getAllProjects');
    
    const rows = this.getStatement(`
      SELECT * FROM projects ORDER BY updated_at DESC
    `).all();
    
    const projects = rows.map((row: any) => this.rowToProject(row));
    timer();
    
    return projects;
  }

  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Check if user should be prompted for database migration
   * This is called by the server to provide migration suggestions
   */
  async checkMigrationPrompt(currentVersion: string): Promise<{ shouldPrompt: boolean; message: string }> {
    try {
      const result = await MigrationPrompter.shouldPromptForMigration(currentVersion, this.db.name);
      return {
        shouldPrompt: result.shouldPrompt,
        message: result.message
      };
    } catch (error) {
      console.warn('Migration prompt check failed:', error);
      return { shouldPrompt: false, message: '' };
    }
  }

  // ========== STREAMING UTILITY METHODS ==========

  /**
   * Helper: Take first N items from a generator (efficient limit)
   * Example: const first10 = Storage.take(storage.streamDecisions(projectId), 10);
   */
  static take<T>(generator: Generator<T>, count: number): T[] {
    const results: T[] = [];
    let i = 0;
    for (const item of generator) {
      if (i >= count) break;
      results.push(item);
      i++;
    }
    return results;
  }

  /**
   * Helper: Convert generator to array (use sparingly with limits!)
   * Example: const allDecisions = Storage.toArray(storage.streamDecisions(projectId, 100));
   */
  static toArray<T>(generator: Generator<T>): T[] {
    return Array.from(generator);
  }

  /**
   * Helper: Filter generator items (lazy evaluation)
   * Example: const filtered = Storage.filter(storage.streamDecisions(projectId), d => d.type === 'architecture');
   */
  static *filter<T>(generator: Generator<T>, predicate: (item: T) => boolean): Generator<T> {
    for (const item of generator) {
      if (predicate(item)) {
        yield item;
      }
    }
  }

  /**
   * Helper: Map generator items (lazy evaluation)
   * Example: const descriptions = Storage.map(storage.streamDecisions(projectId), d => d.description);
   */
  static *map<T, U>(generator: Generator<T>, transform: (item: T) => U): Generator<U> {
    for (const item of generator) {
      yield transform(item);
    }
  }

  close(): void {
    this.db.close();
  }
}