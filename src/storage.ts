import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type {
  ProjectContext,
  Conversation,
  Decision,
  ContextSummary,
  StorageInterface,
} from './types.js';
import {createTodoTable} from './todo-schema.js';

export class Storage implements StorageInterface {
  private db: Database.Database;
  
  // Prepared statement cache for 2-5x faster queries
  private preparedStatements: Map<string, Database.Statement> = new Map();

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

      CREATE INDEX IF NOT EXISTS idx_conversations_project 
        ON conversations(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_decisions_project 
        ON decisions(project_id, timestamp DESC);
    `);
  }

  /**
   * Get or create a prepared statement for faster queries (2-5x performance improvement)
   */
  private getStatement(sql: string): Database.Statement {
    if (this.preparedStatements.has(sql)) {
      return this.preparedStatements.get(sql)!;
    }
    
    const statement = this.db.prepare(sql);
    this.preparedStatements.set(sql, statement);
    return statement;
  }

  createProject(name: string, projectPath?: string): ProjectContext {
    const id = randomUUID();
    const now = Date.now();
    const techStack: string[] = [];

    // Set this as current project (unset others) - use cached prepared statement
    this.getStatement('UPDATE projects SET is_current = 0').run();

    // Insert new project - use cached prepared statement
    this.getStatement(`
      INSERT INTO projects (id, name, path, tech_stack, created_at, updated_at, is_current)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(id, name, projectPath || null, JSON.stringify(techStack), now, now);

    return {
      id,
      name,
      path: projectPath,
      techStack,
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

  getCurrentProject(): ProjectContext | null {
    const row = this.getStatement(`
      SELECT * FROM projects WHERE is_current = 1 LIMIT 1
    `).get() as any;

    if (!row) return null;

    return this.rowToProject(row);
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
    const row = this.getStatement(`
      SELECT * FROM projects WHERE path = ?
    `).get(projectPath) as any;

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

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}