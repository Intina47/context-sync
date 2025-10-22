/**
 * Todo item types and interfaces
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  tags: string[];
  dueDate?: string; // ISO 8601 format
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  projectId?: string; // Optional link to a project
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  tags?: string[];
  dueDate?: string;
  projectId?: string;
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  tags?: string[];
  dueDate?: string;
  projectId?: string;
}

export interface TodoFilter {
  status?: TodoStatus | TodoStatus[];
  priority?: TodoPriority | TodoPriority[];
  tags?: string[];
  projectId?: string;
  dueBefore?: string;
  dueAfter?: string;
  search?: string; // Search in title and description
}

export interface TodoStats {
  total: number;
  byStatus: Record<TodoStatus, number>;
  byPriority: Record<TodoPriority, number>;
  overdue: number;
  dueSoon: number; // Due within 24 hours
}
