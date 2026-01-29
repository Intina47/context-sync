/**
 * Core Tool Definitions - The 9 Essential Tools
 * Set of core tools: 8 project tools + 1 documentation tool (Notion)
 */

export const CORE_TOOLS = [
  // ========== PROJECT MANAGEMENT ==========
  {
    name: 'set_project',
    description: 'Initialize a project for context tracking. Detects project type, tech stack, and architecture. Call this once when starting work on a new project. This is the foundation - run this first.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { 
          type: 'string',
          description: 'Absolute path to project directory'
        },
        purpose: {
          type: 'string',
          description: 'Optional: What this project does (if not in README)'
        }
      },
      required: ['path']
    }
  },

  // ========== MEMORY ==========
  {
    name: 'remember',
    description: `Store important context about the project. Use when the user shares something that matters for future sessions: active work, architectural constraints, problems encountered, goals, decisions, notes, or **caveats** (AI mistakes/tech debt).

** NEW: CAVEAT TYPE - Track AI Mistakes & Tech Debt**

When you (the AI) realize something went wrong, ALWAYS call remember with type='caveat':
- You tried something that didn't work
- You took a shortcut instead of proper solution  
- You made changes but didn't verify them
- You made assumptions that might be wrong
- You used a workaround instead of fixing root cause

**Caveat Categories:**
- **mistake**: Tried X, got error Y, did workaround Z (not ideal)
- **shortcut**: Skipped proper testing/verification to save time
- **unverified**: Made changes but didn't build/test/verify
- **assumption**: Assumed X works without checking
- **workaround**: Fixed symptom but not root cause

**Caveat Metadata (REQUIRED):**
- **severity**: 'low' | 'medium' | 'high' | 'critical'
- **attempted**: What you tried to do
- **error**: What went wrong (if applicable)
- **recovery**: What you did instead
- **verified**: true/false - Did you test the recovery?
- **action_required**: What user needs to do (e.g., "Restart MCP server")
- **affects_production**: true/false - Will users hit this issue?

**Example - Git Tool MCP Issue:**
\`\`\`typescript
remember(
  type: 'caveat',
  content: 'Git tool updated with 6 new actions but MCP validation fails',
  metadata: {
    category: 'unverified',
    severity: 'medium',
    attempted: 'Test new git actions via MCP',
    error: 'Schema validation error - actions not in allowed values',
    recovery: 'Created manual test script instead',
    verified: true, // Test script worked
    action_required: 'User must restart MCP server for new actions to work',
    affects_production: true // MCP users affected until restart
  }
)
\`\`\`

**When to Use Caveats:**
 "Actually, I realize..."  CAVEAT
 "Let me try a different approach..."  CAVEAT (first approach failed)
 "Hmm, that didn't work..."  CAVEAT
 "Wait, on second thought..."  CAVEAT (assumption was wrong)
 Made changes but didn't run build/test  CAVEAT (unverified)
 Used workaround instead of proper fix  CAVEAT (shortcut)

**This makes Context Sync the FIRST tool to track AI mistakes as technical context!**

**Command Language:** Users may say "cs remember" (git-style command). When they do, analyze the conversation and save relevant context.

**AI-Driven Checkpoint Mode:**
When the user says "cs remember" or "remember this conversation" WITHOUT specifying type/content, YOU (the AI) should:

1. **Analyze the Recent Conversation** (last 5-10 messages)
2. **Extract Context Categories:**
   - Active Work: What task is currently being worked on? Files being edited? Branch name?
   - Constraints: Any architectural rules, technology choices, or limitations mentioned?
   - Problems: Blockers, bugs, errors, or issues discussed?
   - Goals: Targets with deadlines? Features to build?
   - Decisions: Important choices made with reasoning?
   - Notes: Other important information worth remembering?
   - **Caveats**: AI mistakes, workarounds, unverified changes?

3. **Call remember() Multiple Times** - Once per item extracted, with structured data:
   - Type: Choose the appropriate category
   - Content: Clear, specific description (1-2 sentences)
   - Metadata: Include file paths, code snippets, links, or other relevant context

**Example Checkpoint Analysis:**
If conversation discusses "building the TypeScript server with 8 core tools, tested successfully via MCP":
- Call remember(type="active_work", content="Building Context Sync server with 8 core tools (set_project, remember, recall, etc.)", metadata={files: ["src/server.ts", "src/core-tools.ts"]})
- Call remember(type="decision", content="Reduced from 50+ tools to 8 core tools, moved rest to internal utilities for simplicity", metadata={reasoning: "Users overwhelmed by too many tools"})
- Call remember(type="active_work", content="Testing implementation via MCP protocol in Cursor", metadata={status: "All 8 tools tested successfully"})

**When to Use Checkpoint Mode:**
- User says "cs remember" with no arguments
- User says "remember this conversation" or "save this session"
- User asks to checkpoint progress before switching tasks
- End of significant work session

**When to Use Direct Mode:**
- User specifies what to remember: "cs remember: using TypeScript for the server"
- Clear type indicated: "cs constraint: must support SQLite"
- Single piece of information to save

This approach leverages YOUR (the AI's) conversation understanding while keeping the server as simple storage.`,
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['active_work', 'constraint', 'problem', 'goal', 'decision', 'note', 'caveat'],
          description: 'What kind of context? active_work=current task, constraint=architectural rule, problem=blocker, goal=target, decision=choice made, note=important info, caveat=AI mistake/tech debt'
        },
        content: {
          type: 'string',
          description: 'What to remember (natural language, be specific)'
        },
        metadata: {
          type: 'object',
          description: 'Optional: Related files, code snippets, links, etc. For caveats: MUST include severity, category, attempted, recovery, verified, action_required, affects_production'
        }
      },
      required: ['type', 'content']
    }
  },

  {
    name: 'recall',
    description: 'Get context about the current project. Returns project identity, active work, constraints, problems, and recent decisions. Call this at the start of a conversation to understand what the user is working on. Essential for "good morning" handoffs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional: Specific aspect to recall (e.g., "what were we working on?", "what constraints do we have?")'
        },
        limit: {
          type: 'number',
          description: 'Optional: How many recent items to return per category (default: 10)'
        }
      }
    }
  },

  // ========== FILE OPERATIONS ==========
  {
    name: 'read_file',
    description: 'Read a file from the current workspace. Use this to understand code context.',
    inputSchema: {
      type: 'object',
      properties: { 
        path: { 
          type: 'string',
          description: 'Relative path from workspace root'
        } 
      },
      required: ['path']
    }
  },

  {
    name: 'search',
    description: 'Search the workspace. Can search by filename pattern or file contents. Use this to discover relevant files or find specific code.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (filename pattern or text content)'
        },
        type: {
          type: 'string',
          enum: ['files', 'content'],
          description: 'Search type: "files" for filename patterns, "content" for text within files'
        },
        options: {
          type: 'object',
          properties: {
            regex: { type: 'boolean', description: 'Use regex for content search' },
            caseSensitive: { type: 'boolean', description: 'Case-sensitive search' },
            filePattern: { type: 'string', description: 'Filter by file pattern (for content search)' },
            maxResults: { type: 'number', description: 'Max results to return' }
          }
        }
      },
      required: ['query', 'type']
    }
  },

  {
    name: 'structure',
    description: 'Get the file/folder structure of current workspace. Use this to understand project layout.',
    inputSchema: {
      type: 'object',
      properties: { 
        depth: { 
          type: 'number',
          description: 'Optional: How deep to traverse (default: 3)'
        } 
      }
    }
  },

  // ========== GIT OPERATIONS ==========
  {
    name: 'git',
    description: `Git repository operations with intelligence. Provides status, context, risk analysis, and code ownership insights.

**Actions:**
- **status**: Current branch, staged/unstaged changes, commit readiness
- **context**: Suggested commit messages, recent commits, branch info
- **hotspots**: Risk analysis - files with high change frequency (indicates complexity/bugs)
- **coupling**: Files that change together (reveals hidden dependencies)
- **blame**: Code ownership - who wrote what (find the expert to ask)
- **analysis**: Comprehensive overview combining all insights

**Use Cases:**
- Before committing: \`git action=status\` + \`git action=context\`
- Understanding risk: \`git action=hotspots\` - find dangerous files
- Refactoring: \`git action=coupling\` - find tightly coupled files
- Need help?: \`git action=blame path=file.ts\` - find the expert
- Big picture: \`git action=analysis\` - complete health check`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'context', 'hotspots', 'coupling', 'blame', 'analysis'],
          description: 'Action: status=changes, context=commits, hotspots=risk, coupling=dependencies, blame=ownership, analysis=overview'
        },
        path: {
          type: 'string',
          description: 'File path (required for action=blame)'
        },
        staged: {
          type: 'boolean',
          description: 'For context: show staged changes (default: false)'
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'For context: specific files to analyze'
        },
        limit: {
          type: 'number',
          description: 'For hotspots: max results (default: 10)'
        },
        minCoupling: {
          type: 'number',
          description: 'For coupling: minimum co-changes (default: 3)'
        }
      },
      required: ['action']
    }
  },

  // ========== DOCUMENTATION ==========
  {
    name: 'notion',
    description: 'Access your Notion workspace documentation. Use notion.search to find pages, notion.read to view content. Essential for pulling in external documentation context.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'read'],
          description: 'Action to perform: "search" to find pages, "read" to view page content'
        },
        query: {
          type: 'string',
          description: 'Search query (required for action=search)'
        },
        pageId: {
          type: 'string',
          description: 'Notion page ID or URL (required for action=read)'
        }
      },
      required: ['action']
    }
  }
] as const;


