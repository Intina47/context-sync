/**
 * MCP Tool handlers for todo management
 * Add these handlers to your server.ts file
 */

import { TodoManager } from './todo-manager.js';
import { CreateTodoInput, UpdateTodoInput, TodoFilter, Todo } from './todo-types.js';

export function createTodoHandlers(todoManager: TodoManager) {
  return {
    /**
     * Create a new todo item
     */
    'todo:create': async (params: CreateTodoInput) => {
      const todo = todoManager.createTodo(params);
      return {
        content: [
          {
            type: 'text',
            text: `✅ Todo created: "${todo.title}"\n\nID: ${todo.id}\nPriority: ${todo.priority}\nStatus: ${todo.status}${todo.dueDate ? `\nDue: ${todo.dueDate}` : ''}${todo.tags.length > 0 ? `\nTags: ${todo.tags.join(', ')}` : ''}`
          }
        ]
      };
    },

    /**
     * Get a specific todo by ID
     */
    'todo:get': async (params: { id: string }) => {
      const todo = todoManager.getTodo(params.id);
      
      if (!todo) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Todo not found: ${params.id}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `📋 **${todo.title}**\n\nStatus: ${todo.status}\nPriority: ${todo.priority}\n${todo.description ? `Description: ${todo.description}\n` : ''}${todo.dueDate ? `Due: ${todo.dueDate}\n` : ''}${todo.tags.length > 0 ? `Tags: ${todo.tags.join(', ')}\n` : ''}Created: ${todo.createdAt}\nUpdated: ${todo.updatedAt}${todo.completedAt ? `\nCompleted: ${todo.completedAt}` : ''}`
          }
        ]
      };
    },

    /**
     * List todos with optional filters
     */
    'todo:list': async (params?: TodoFilter) => {
      const todos = todoManager.listTodos(params);
      
      if (todos.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📝 No todos found'
            }
          ]
        };
      }

      const grouped = {
        urgent: todos.filter(t => t.priority === 'urgent' && t.status !== 'completed'),
        high: todos.filter(t => t.priority === 'high' && t.status !== 'completed'),
        medium: todos.filter(t => t.priority === 'medium' && t.status !== 'completed'),
        low: todos.filter(t => t.priority === 'low' && t.status !== 'completed'),
        completed: todos.filter(t => t.status === 'completed')
      };

      let output = `📋 Found ${todos.length} todo(s)\n\n`;

      const formatTodo = (todo: Todo) => {
        const statusEmoji = {
          pending: '⏳',
          in_progress: '🔄',
          completed: '✅',
          cancelled: '❌'
        };
        return `${statusEmoji[todo.status]} ${todo.title}${todo.dueDate ? ` (Due: ${todo.dueDate})` : ''}\n   ID: ${todo.id}`;
      };

      if (grouped.urgent.length > 0) {
        output += `🔴 **URGENT** (${grouped.urgent.length})\n`;
        grouped.urgent.forEach(todo => output += formatTodo(todo) + '\n');
        output += '\n';
      }

      if (grouped.high.length > 0) {
        output += `🟠 **HIGH** (${grouped.high.length})\n`;
        grouped.high.forEach(todo => output += formatTodo(todo) + '\n');
        output += '\n';
      }

      if (grouped.medium.length > 0) {
        output += `🟡 **MEDIUM** (${grouped.medium.length})\n`;
        grouped.medium.forEach(todo => output += formatTodo(todo) + '\n');
        output += '\n';
      }

      if (grouped.low.length > 0) {
        output += `🟢 **LOW** (${grouped.low.length})\n`;
        grouped.low.forEach(todo => output += formatTodo(todo) + '\n');
        output += '\n';
      }

      if (grouped.completed.length > 0 && !params?.status) {
        output += `✅ **COMPLETED** (${grouped.completed.length})\n`;
        grouped.completed.slice(0, 5).forEach(todo => output += formatTodo(todo) + '\n');
        if (grouped.completed.length > 5) {
          output += `   ... and ${grouped.completed.length - 5} more\n`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
    },

    /**
     * Update a todo
     */
    'todo:update': async (params: UpdateTodoInput) => {
      const todo = todoManager.updateTodo(params);
      
      if (!todo) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Todo not found: ${params.id}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Todo updated: "${todo.title}"\n\nStatus: ${todo.status}\nPriority: ${todo.priority}\nUpdated: ${todo.updatedAt}`
          }
        ]
      };
    },

    /**
     * Delete a todo
     */
    'todo:delete': async (params: { id: string }) => {
      const success = todoManager.deleteTodo(params.id);
      
      if (!success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Todo not found: ${params.id}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Todo deleted: ${params.id}`
          }
        ]
      };
    },

    /**
     * Mark todo as completed
     */
    'todo:complete': async (params: { id: string }) => {
      const todo = todoManager.completeTodo(params.id);
      
      if (!todo) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Todo not found: ${params.id}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Todo completed: "${todo.title}"\n\nCompleted at: ${todo.completedAt}`
          }
        ]
      };
    },

    /**
     * Get todo statistics
     */
    'todo:stats': async (params?: { projectId?: string }) => {
      const stats = todoManager.getStats(params?.projectId);
      
      let output = `📊 Todo Statistics\n\n`;
      output += `**Total:** ${stats.total} todos\n\n`;
      
      output += `**By Status:**\n`;
      output += `⏳ Pending: ${stats.byStatus.pending}\n`;
      output += `🔄 In Progress: ${stats.byStatus.in_progress}\n`;
      output += `✅ Completed: ${stats.byStatus.completed}\n`;
      output += `❌ Cancelled: ${stats.byStatus.cancelled}\n\n`;
      
      output += `**By Priority:**\n`;
      output += `🔴 Urgent: ${stats.byPriority.urgent}\n`;
      output += `🟠 High: ${stats.byPriority.high}\n`;
      output += `🟡 Medium: ${stats.byPriority.medium}\n`;
      output += `🟢 Low: ${stats.byPriority.low}\n\n`;
      
      if (stats.overdue > 0) {
        output += `⚠️  **${stats.overdue} overdue** todo(s)\n`;
      }
      
      if (stats.dueSoon > 0) {
        output += `⏰ **${stats.dueSoon} due soon** (within 24 hours)\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
    },

    /**
     * Get all tags
     */
    'todo:tags': async () => {
      const tags = todoManager.getAllTags();
      
      if (tags.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '🏷️  No tags found'
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `🏷️  Available tags (${tags.length}):\n\n${tags.join(', ')}`
          }
        ]
      };
    }
  };
}
