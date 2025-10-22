/**
 * MCP Tool definitions for todo management
 * Add these tool definitions to your server's tool list
 */

export const todoToolDefinitions = [
  {
    name: 'todo_create',
    description: 'Create a new todo item in the global todo list',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the todo item'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the todo (optional)'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Priority level (default: medium)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to categorize the todo (optional)'
        },
        dueDate: {
          type: 'string',
          description: 'Due date in ISO 8601 format (optional)'
        },
        projectId: {
          type: 'string',
          description: 'Link to a specific project (optional)'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'todo_get',
    description: 'Get a specific todo item by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the todo item'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'todo_list',
    description: 'List todos with optional filters. Returns todos grouped by priority.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          oneOf: [
            { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
            { 
              type: 'array',
              items: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] }
            }
          ],
          description: 'Filter by status (single value or array)'
        },
        priority: {
          oneOf: [
            { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            { 
              type: 'array',
              items: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }
            }
          ],
          description: 'Filter by priority (single value or array)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (returns todos with any of these tags)'
        },
        projectId: {
          type: 'string',
          description: 'Filter by project ID'
        },
        dueBefore: {
          type: 'string',
          description: 'Filter todos due before this date (ISO 8601)'
        },
        dueAfter: {
          type: 'string',
          description: 'Filter todos due after this date (ISO 8601)'
        },
        search: {
          type: 'string',
          description: 'Search in title and description'
        }
      }
    }
  },
  {
    name: 'todo_update',
    description: 'Update a todo item. Only provided fields will be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the todo to update'
        },
        title: {
          type: 'string',
          description: 'New title'
        },
        description: {
          type: 'string',
          description: 'New description'
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          description: 'New status'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'New priority'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags (replaces existing tags)'
        },
        dueDate: {
          type: 'string',
          description: 'New due date in ISO 8601 format'
        },
        projectId: {
          type: 'string',
          description: 'New project ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'todo_delete',
    description: 'Delete a todo item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the todo to delete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'todo_complete',
    description: 'Mark a todo as completed (shortcut for updating status)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the todo to complete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'todo_stats',
    description: 'Get statistics about todos (counts by status, priority, overdue, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Get stats for a specific project (optional)'
        }
      }
    }
  },
  {
    name: 'todo_tags',
    description: 'Get a list of all unique tags used in todos',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];
