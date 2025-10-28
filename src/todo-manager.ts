/**
 * Todo management handlers for Context Sync MCP server
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  Todo,
  TodoStatus,
  TodoPriority,
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilter,
  TodoStats
} from './todo-types';

export class TodoManager {
  // Prepared statement cache for 2-5x faster queries
  private preparedStatements: Map<string, Database.Statement> = new Map();
  
  constructor(private db: Database.Database) {}

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

  /**
   * Create a new todo item
   */
  createTodo(input: CreateTodoInput): Todo {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const todo: Todo = {
      id,
      title: input.title,
      description: input.description,
      status: 'pending',
      priority: input.priority || 'medium',
      tags: input.tags || [],
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
      projectId: input.projectId
    };

    const stmt = this.getStatement(`
      INSERT INTO todos (
        id, title, description, status, priority, tags,
        due_date, created_at, updated_at, project_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      todo.id,
      todo.title,
      todo.description || null,
      todo.status,
      todo.priority,
      JSON.stringify(todo.tags),
      todo.dueDate || null,
      todo.createdAt,
      todo.updatedAt,
      todo.projectId || null
    );

    return todo;
  }

  /**
   * Get a todo by ID
   */
  getTodo(id: string): Todo | null {
    const stmt = this.getStatement(`
      SELECT * FROM todos WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    if (!row) return null;
    
    return this.rowToTodo(row);
  }

  /**
   * List todos with optional filtering
   */
  listTodos(filter?: TodoFilter): Todo[] {
    let query = 'SELECT * FROM todos WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query += ` AND status IN (${filter.status.map(() => '?').join(',')})`;
        params.push(...filter.status);
      } else {
        query += ' AND status = ?';
        params.push(filter.status);
      }
    }

    if (filter?.priority) {
      if (Array.isArray(filter.priority)) {
        query += ` AND priority IN (${filter.priority.map(() => '?').join(',')})`;
        params.push(...filter.priority);
      } else {
        query += ' AND priority = ?';
        params.push(filter.priority);
      }
    }

    if (filter?.projectId) {
      query += ' AND project_id = ?';
      params.push(filter.projectId);
    }

    if (filter?.dueBefore) {
      query += ' AND due_date <= ?';
      params.push(filter.dueBefore);
    }

    if (filter?.dueAfter) {
      query += ' AND due_date >= ?';
      params.push(filter.dueAfter);
    }

    if (filter?.search) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (filter?.tags && filter.tags.length > 0) {
      // Search for todos that have at least one of the specified tags
      const tagConditions = filter.tags.map(() => 'tags LIKE ?').join(' OR ');
      query += ` AND (${tagConditions})`;
      filter.tags.forEach(tag => {
        params.push(`%"${tag}"%`);
      });
    }

    query += ' ORDER BY priority DESC, due_date ASC, created_at DESC';

    const stmt = this.getStatement(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.rowToTodo(row));
  }

  /**
   * Update a todo
   */
  updateTodo(input: UpdateTodoInput): Todo | null {
    const existing = this.getTodo(input.id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }

    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
      
      // Set completed_at when marking as completed
      if (input.status === 'completed') {
        updates.push('completed_at = ?');
        params.push(now);
      }
    }

    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }

    if (input.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(input.tags));
    }

    if (input.dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(input.dueDate);
    }

    if (input.projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(input.projectId);
    }

    updates.push('updated_at = ?');
    params.push(now);

    params.push(input.id);

    const stmt = this.getStatement(`
      UPDATE todos SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...params);
    
    return this.getTodo(input.id);
  }

  /**
   * Delete a todo
   */
  deleteTodo(id: string): boolean {
    const stmt = this.getStatement('DELETE FROM todos WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Mark todo as completed
   */
  completeTodo(id: string): Todo | null {
    return this.updateTodo({
      id,
      status: 'completed'
    });
  }

  /**
   * Get todo statistics
   */
  getStats(projectId?: string): TodoStats {
    let baseQuery = 'SELECT status, priority, due_date FROM todos';
    const params: any[] = [];
    
    if (projectId) {
      baseQuery += ' WHERE project_id = ?';
      params.push(projectId);
    }

    const stmt = this.getStatement(baseQuery);
    const rows = stmt.all(...params) as any[];

    const stats: TodoStats = {
      total: rows.length,
      byStatus: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      },
      overdue: 0,
      dueSoon: 0
    };

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    rows.forEach(row => {
      stats.byStatus[row.status as TodoStatus]++;
      stats.byPriority[row.priority as TodoPriority]++;

      if (row.due_date && row.status !== 'completed' && row.status !== 'cancelled') {
        const dueDate = new Date(row.due_date);
        if (dueDate < now) {
          stats.overdue++;
        } else if (dueDate < tomorrow) {
          stats.dueSoon++;
        }
      }
    });

    return stats;
  }

  /**
   * Get all unique tags across todos
   */
  getAllTags(): string[] {
    const stmt = this.getStatement('SELECT tags FROM todos WHERE tags IS NOT NULL');
    const rows = stmt.all() as any[];
    
    const tagSet = new Set<string>();
    rows.forEach(row => {
      try {
        const tags = JSON.parse(row.tags);
        tags.forEach((tag: string) => tagSet.add(tag));
      } catch (e) {
        // Skip invalid JSON
      }
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Convert database row to Todo object
   */
  private rowToTodo(row: any): Todo {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      tags: row.tags ? JSON.parse(row.tags) : [],
      dueDate: row.due_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      projectId: row.project_id || undefined
    };
  }
}
