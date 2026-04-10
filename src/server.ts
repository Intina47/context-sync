/**
 * Context Sync Server - Core Simplification
 * 8 essential tools, everything else is internal
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Storage } from './storage.js';
import { ProjectDetector } from './project-detector.js';
import { WorkspaceDetector } from './workspace-detector.js';
import { CORE_TOOLS } from './core-tools.js';
import type { RememberInput } from './context-layers.js';
import { ProjectProfiler } from './project-profiler.js';
import { RecallEngine } from './recall-engine.js';
import { RememberEngine } from './remember-engine.js';
import { GitToolHandler, type GitToolArgs } from './git-tool-handler.js';
import { NotionToolHandler, type NotionToolArgs } from './notion-tool-handler.js';
import { WorkspaceToolHandler, type SearchToolArgs } from './workspace-tool-handler.js';
import { NotionIntegration } from './notion-integration.js';
import { createNotionHandlers } from './notion-handlers.js';
import { SchemaMigrator } from './schema-migration.js';
import type { ProjectContext } from './types.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { errorResponse, stackErrorResponse, textResponse, type ToolResponse } from './tool-responses.js';

type PromptRequest = { params: { name: string } };
type ResourceRequest = { params: { uri: string } };
type ToolCallRequest = { params: { name: string; arguments?: unknown } };

export class ContextSyncServer {
  private server: Server;
  private storage: Storage;
  private projectDetector: ProjectDetector;
  private workspaceDetector: WorkspaceDetector;
  private notionIntegration: NotionIntegration | null = null;
  private notionHandlers: ReturnType<typeof createNotionHandlers>;
  
  // Session-specific current project
  private currentProjectId: string | null = null;

  constructor(storagePath?: string) {
    this.storage = new Storage(storagePath);
    this.projectDetector = new ProjectDetector(this.storage);
    this.workspaceDetector = new WorkspaceDetector(this.storage, this.projectDetector);

    // Initialize with null integration (will be set up if config exists)
    this.notionHandlers = createNotionHandlers(null);

    // Run v1  schema migration if needed (safe, automatic, with backup)
    this.runMigrationIfNeeded();

    this.server = new Server(
      {
        name: 'context-sync',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Initialize Notion integration from user config
   */
  private async initializeNotion(): Promise<void> {
    try {
      const configPath = path.join(os.homedir(), '.context-sync', 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      if (config.notion?.token) {
        this.notionIntegration = new NotionIntegration({
          token: config.notion.token,
          defaultParentPageId: config.notion.defaultParentPageId
        });
      }
    } catch {
      // Config doesn't exist or invalid - Notion not configured
      this.notionIntegration = null;
    }
    
    // Always create handlers (they handle null gracefully)
    this.notionHandlers = createNotionHandlers(this.notionIntegration);
  }

  /**
   * Run v1  schema migration automatically if needed
   * Safe, atomic, with automatic backup
   */
  private runMigrationIfNeeded(): void {
    try {
      const migrator = new SchemaMigrator(this.storage.getDb());
      
      // Check if migration already completed
      if (SchemaMigrator.hasCompletedMigration(this.storage.getDb())) {
        return; // Already migrated
      }
      
      // Check if migration is needed
      if (!migrator.needsMigration()) {
        return; // No v1 data to migrate
      }
      
      // Perform migration (synchronous)
      console.error('\n' + '='.repeat(60));
      console.error(' Context Sync - First Time Setup');
      console.error('='.repeat(60));
      console.error('Detected v1.x data. Migrating to current schema...');
      console.error('This is safe and automatic. A backup will be created.\n');
      
      const result = migrator.migrateSync();
      
      if (result.success) {
        console.error('\n' + '='.repeat(60));
        console.error(' Migration Complete!');
        console.error('='.repeat(60));
        console.error('Your context has been preserved and enhanced.');
        console.error('Continue using Context Sync normally.');
        console.error('Backup saved to:', result.backupPath);
        console.error('='.repeat(60) + '\n');
      } else {
        console.error('\n  Migration encountered issues:');
        result.errors.forEach((err: string) => console.error(`   ${err}`));
        console.error('\nYour data is safe. Please report this issue.');
        console.error('Backup available at:', result.backupPath, '\n');
      }
    } catch (error: any) {
      console.error('  Migration check failed:', error.message);
      console.error('Continuing with current database state...\n');
    }
  }

  private setupHandlers(): void {
    // List our 8 core tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: CORE_TOOLS,
    }));

    // List available prompts (AI usage instructions)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'context-sync-usage',
          description: 'Complete guide on how to use Context Sync effectively as an AI agent',
        },
        {
          name: 'debugging-context-sync',
          description: 'How to debug Context Sync when things go wrong',
        },
      ],
    }));

    // Get prompt content
    this.server.setRequestHandler(GetPromptRequestSchema, async (request: PromptRequest) => {
      const { name } = request.params;

      if (name === 'context-sync-usage') {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Context Sync - AI Agent Usage Guide

##  Core Philosophy
Context Sync is YOUR memory system. Use it to understand projects deeply and maintain context across sessions.

##  Correct Tool Flow

### 1 ALWAYS START: set_project
**Before doing ANYTHING else in a new project:**
\`\`\`
set_project({ path: "/absolute/path/to/project", purpose: "Brief description" })
\`\`\`

This initializes the project and captures:
- Tech stack detection (Go, TypeScript, Python, etc.)
- Dependencies with exact versions
- Build system and commands
- Test framework and coverage
- Environment variables
- Services and databases
- Quality metrics

** WRONG:** Calling structure() or search() before set_project
** RIGHT:** set_project  then structure/search/recall

### 2 Explore with structure() and search()
\`\`\`
structure({ depth: 3 })  // Get project file tree
search({ query: "function name", type: "content" })  // Find code
\`\`\`

### 3 Save important context with remember()
\`\`\`
remember({ 
  type: "constraint",
  content: "Always use TypeScript strict mode",
  metadata: { files: ["tsconfig.json"] }
})
\`\`\`

Types: active_work, constraint, problem, goal, decision, note

### 4 Retrieve context with recall()
\`\`\`
recall({ query: "what were we working on?" })
\`\`\`

Returns: active work, constraints, problems, goals, decisions, notes

##  Common Mistakes

### Mistake 1: Calling tools before set_project
\`\`\`
 structure()  Error: No project set
 set_project()  structure()  Success
\`\`\`

### Mistake 2: Using wrong project path
Context Sync tracks ONE project at a time. If you call set_project with a different path, it switches to that project.

### Mistake 3: Not using recall() at session start
When a user says "continue where we left off" or "good morning", ALWAYS call recall() first.

##  Pro Tips

1. **set_project is SMART** - It detects multi-language projects (e.g., Go app distributed via npm)
2. **Use remember() liberally** - Save architectural decisions, constraints, active work
3. **structure() before read_file** - Understand layout first, then read specific files
4. **git_status + git_context** - Perfect combo for understanding recent changes

##  Command Language (User-Facing)
Users may use these natural commands:
- "cs init"  set_project
- "cs remember X"  remember(type: note, content: X)
- "cs recall" or "cs status"  recall()
- "cs constraint X"  remember(type: constraint, ...)

##  Tool Chain Examples

### Example 1: New Project Investigation
\`\`\`
1. set_project({ path: "/path/to/project" })
2. structure({ depth: 2 })
3. search({ query: "main entry point", type: "files" })
4. read_file({ path: "src/index.ts" })
5. remember({ type: "active_work", content: "Investigating project structure" })
\`\`\`

### Example 2: Debugging Session
\`\`\`
1. set_project({ path: "/path/to/project" })
2. recall()  // What was I working on?
3. git_status()  // What changed?
4. git_context({ staged: false })  // Show me the diff
5. remember({ type: "problem", content: "Bug in user auth" })
\`\`\`

### Example 3: "Good Morning" Handoff
\`\`\`
1. set_project({ path: "/path/to/project" })
2. recall({ query: "active work and recent decisions" })
3. git_status()  // Any uncommitted changes?
4. structure()  // Refresh mental model
\`\`\``,
              },
            },
          ],
        };
      }

      if (name === 'debugging-context-sync') {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Debugging Context Sync

##  Common Issues & Solutions

### Issue 1: "No project set" error
**Cause:** Trying to use tools before initializing
**Solution:** Always call set_project() first

### Issue 2: Wrong tech stack detected
**Symptoms:** Go project shows as Node.js (or vice versa)
**Cause:** Multi-language project (e.g., Go app with npm packaging)
**Debug:**
\`\`\`
1. set_project({ path: "/path" })
2. structure({ depth: 2 })  // Check for package.json, go.mod, etc.
3. Check packaging/ folder for distribution wrappers
\`\`\`

**Context Sync prioritizes:**
1. Node.js (if package.json exists)
2. Python (if requirements.txt/pyproject.toml)
3. Rust (if Cargo.toml)
4. Go (if go.mod)

### Issue 3: Missing dependencies/metrics
**Cause:** Project not fully analyzed
**Solution:** Re-run set_project, check for node_modules or equivalent

### Issue 4: Database errors (e.g., "no such table")
**Cause:** schema not migrated
**Solution:** Delete ~/.context-sync/data.db and reinitialize

### Issue 5: Tool returns empty results
**Cause:** Wrong project path or not initialized
**Debug:**
\`\`\`
1. Check current project: recall()
2. Verify path exists: set_project with correct absolute path
3. Confirm structure: structure({ depth: 1 })
\`\`\`

##  Self-Testing Context Sync

If you suspect Context Sync is broken:
\`\`\`
1. set_project({ path: "/known/working/project" })
2. structure()  // Should show file tree
3. remember({ type: "note", content: "Test note" })
4. recall()  // Should show the test note
\`\`\`

##  Understanding Detection Results

When set_project shows unexpected results, USE structure() to understand WHY:
- See what config files exist (package.json, go.mod, Cargo.toml)
- Check for packaging/ folder (distribution wrappers)
- Look for multiple language directories

Example: Jot project
- Has: go.mod, main.go (Go source)
- Also has: packaging/npm/package.json (npm distribution)
- Correct detection: Go (primary language)
- npm is just a distribution wrapper`,
              },
            },
          ],
        };
      }

      throw new Error(`Unknown prompt: ${name}`);
    });

    // List available resources (AI documentation)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'context-sync://docs/usage-guide',
          mimeType: 'text/markdown',
          name: 'Context Sync Usage Guide',
          description: 'Complete guide on how to use Context Sync effectively as an AI agent',
        },
        {
          uri: 'context-sync://docs/debugging-guide',
          mimeType: 'text/markdown',
          name: 'Debugging Context Sync',
          description: 'How to debug Context Sync when things go wrong',
        },
        {
          uri: 'context-sync://docs/tool-flow',
          mimeType: 'text/markdown',
          name: 'Tool Flow Patterns',
          description: 'Common tool usage patterns and workflows',
        },
      ],
    }));

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request: ResourceRequest) => {
      const { uri } = request.params;

      if (uri === 'context-sync://docs/usage-guide') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Context Sync - AI Agent Usage Guide

##  Core Philosophy
Context Sync is YOUR memory system. Use it to understand projects deeply and maintain context across sessions.

##  Correct Tool Flow

### 1 ALWAYS START: set_project
**Before doing ANYTHING else in a new project:**
\`\`\`javascript
set_project({ path: "/absolute/path/to/project", purpose: "Brief description" })
\`\`\`

This initializes the project and captures:
- Tech stack detection (Go, TypeScript, Python, etc.)
- Dependencies with exact versions
- Build system and commands
- Test framework and coverage
- Environment variables
- Services and databases
- Quality metrics

** WRONG:** Calling structure() or search() before set_project
** RIGHT:** set_project  then structure/search/recall

### 2 Explore with structure() and search()
\`\`\`javascript
structure({ depth: 3 })  // Get project file tree
search({ query: "function name", type: "content" })  // Find code
\`\`\`

### 3 Save important context with remember()
\`\`\`javascript
remember({ 
  type: "constraint",
  content: "Always use TypeScript strict mode",
  metadata: { files: ["tsconfig.json"] }
})
\`\`\`

Types: active_work, constraint, problem, goal, decision, note

### 4 Retrieve context with recall()
\`\`\`javascript
recall({ query: "what were we working on?" })
\`\`\`

Returns: active work, constraints, problems, goals, decisions, notes

##  Common Mistakes

### Mistake 1: Calling tools before set_project
\`\`\`
 structure()  Error: No project set
 set_project()  structure()  Success
\`\`\`

### Mistake 2: Using wrong project path
Context Sync tracks ONE project at a time. If you call set_project with a different path, it switches to that project.

### Mistake 3: Not using recall() at session start
When a user says "continue where we left off" or "good morning", ALWAYS call recall() first.

##  Pro Tips

1. **set_project is SMART** - It detects multi-language projects (e.g., Go app distributed via npm)
2. **Use remember() liberally** - Save architectural decisions, constraints, active work
3. **structure() before read_file** - Understand layout first, then read specific files
4. **git_status + git_context** - Perfect combo for understanding recent changes

##  Command Language (User-Facing)
Users may use these natural commands:
- "cs init"  set_project
- "cs remember X"  remember(type: note, content: X)
- "cs recall" or "cs status"  recall()
- "cs constraint X"  remember(type: constraint, ...)`,
            },
          ],
        };
      }

      if (uri === 'context-sync://docs/debugging-guide') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Debugging Context Sync

##  Common Issues & Solutions

### Issue 1: "No project set" error
**Cause:** Trying to use tools before initializing
**Solution:** Always call set_project() first

### Issue 2: Wrong tech stack detected
**Symptoms:** Go project shows as Node.js (or vice versa)
**Cause:** Multi-language project (e.g., Go app with npm packaging)
**Debug:**
\`\`\`
1. set_project({ path: "/path" })
2. structure({ depth: 2 })  // Check for package.json, go.mod, etc.
3. Check packaging/ folder for distribution wrappers
\`\`\`

**Context Sync prioritizes:**
1. Node.js (if package.json exists)
2. Python (if requirements.txt/pyproject.toml)
3. Rust (if Cargo.toml)
4. Go (if go.mod)

### Issue 3: Missing dependencies/metrics
**Cause:** Project not fully analyzed
**Solution:** Re-run set_project, check for node_modules or equivalent

### Issue 4: Database errors (e.g., "no such table")
**Cause:** schema not migrated
**Solution:** Delete ~/.context-sync/data.db and reinitialize

### Issue 5: Tool returns empty results
**Cause:** Wrong project path or not initialized
**Debug:**
\`\`\`
1. Check current project: recall()
2. Verify path exists: set_project with correct absolute path
3. Confirm structure: structure({ depth: 1 })
\`\`\`

##  Self-Testing Context Sync

If you suspect Context Sync is broken:
\`\`\`
1. set_project({ path: "/known/working/project" })
2. structure()  // Should show file tree
3. remember({ type: "note", content: "Test note" })
4. recall()  // Should show the test note
\`\`\`

##  Understanding Detection Results

When set_project shows unexpected results, USE structure() to understand WHY:
- See what config files exist (package.json, go.mod, Cargo.toml)
- Check for packaging/ folder (distribution wrappers)
- Look for multiple language directories

Example: Jot project
- Has: go.mod, main.go (Go source)
- Also has: packaging/npm/package.json (npm distribution)
- Correct detection: Go (primary language)
- npm is just a distribution wrapper`,
            },
          ],
        };
      }

      if (uri === 'context-sync://docs/tool-flow') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Tool Flow Patterns

## Pattern 1: New Project Investigation
\`\`\`javascript
1. set_project({ path: "/path/to/project" })
2. structure({ depth: 2 })
3. search({ query: "main entry point", type: "files" })
4. read_file({ path: "src/index.ts" })
5. remember({ type: "active_work", content: "Investigating project structure" })
\`\`\`

## Pattern 2: Debugging Session
\`\`\`javascript
1. set_project({ path: "/path/to/project" })
2. recall()  // What was I working on?
3. git_status()  // What changed?
4. git_context({ staged: false })  // Show me the diff
5. remember({ type: "problem", content: "Bug in user auth" })
\`\`\`

## Pattern 3: "Good Morning" Handoff
\`\`\`javascript
1. set_project({ path: "/path/to/project" })
2. recall({ query: "active work and recent decisions" })
3. git_status()  // Any uncommitted changes?
4. structure()  // Refresh mental model
\`\`\`

## Pattern 4: Architecture Analysis
\`\`\`javascript
1. set_project({ path: "/path/to/project" })
2. structure({ depth: 3 })  // Full tree
3. search({ query: "class|interface|type", type: "content" })
4. remember({ type: "constraint", content: "Layered architecture: UI  Service  Data" })
\`\`\`

## Pattern 5: Feature Implementation
\`\`\`javascript
1. recall()  // Check existing constraints
2. search({ query: "similar feature", type: "content" })
3. read_file({ path: "examples/feature.ts" })
4. remember({ type: "decision", content: "Using X pattern because Y" })
5. git_status()  // Track changes
\`\`\`

##  Quick Reference

**Always start with:** set_project()
**For exploration:** structure()  search()  read_file()
**For memory:** remember() and recall()
**For changes:** git_status()  git_context()`,
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: ToolCallRequest) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'set_project':
          return await this.handleSetProject(args as any);
        case 'remember':
          return await this.handleRemember(args as any);
        case 'recall':
          return await this.handleRecall(args as any);
        case 'read_file':
          return await this.handleReadFile(args as any);
        case 'search':
          return await this.handleSearch(args as any);
        case 'structure':
          return await this.handleStructure(args as any);
        case 'git':
          return await this.handleGit(args as any);
        case 'notion':
          return await this.handleNotion(args as any);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  // ========== CORE HANDLERS ==========

  /**
   * Initialize a project - DEEP ANALYSIS (10x context quality)
   * Goes far beyond basic detection:
   * - Exact dependency versions
   * - Build system commands  
   * - Test framework & coverage
   * - Environment variables
   * - Services & databases
   * - Quality metrics & hotspots
   */
  private async handleSetProject(args: { path: string; purpose?: string }) {
    try {
      const { path: projectPath, purpose } = args;

      // Validate path
      await fs.access(projectPath);
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }

      // Initialize workspace
      await this.workspaceDetector.setWorkspace(projectPath);

      let structurePreview = '';
      try {
        const structureEngine = new StructureEngine(projectPath);
        const structure = await structureEngine.getStructure(2, {
          includeMetadata: false,
          analyzeComplexity: false,
          detectHotspots: false
        });
        structurePreview = ` **Project Structure (depth 2)**\n\n\`\`\`\n${structure.tree}\`\`\`\n\n`;
      } catch (error: any) {
        structurePreview = '';
      }

      // Check if project already exists in database
      // NORMALIZE paths to lowercase for case-insensitive comparison (Windows)
      const normalizedPath = projectPath.toLowerCase();
      const existingProjects = this.storage.getAllProjects();
      const existing = existingProjects.find(p => p.path?.toLowerCase() === normalizedPath);

      if (existing) {
        // PROJECT EXISTS - Just set as current workspace, no re-analysis
        this.currentProjectId = existing.id;
        
        // Generate lightweight response
        const db = this.storage.getDb();
        const deps = db.prepare('SELECT COUNT(*) as count FROM project_dependencies WHERE project_id = ? AND critical = 1').get(existing.id) as any;
        const envVars = db.prepare('SELECT COUNT(*) as count FROM project_env_vars WHERE project_id = ? AND required = 1').get(existing.id) as any;
        const services = db.prepare('SELECT COUNT(*) as count FROM project_services WHERE project_id = ?').get(existing.id) as any;
        const databases = db.prepare('SELECT COUNT(*) as count FROM project_databases WHERE project_id = ?').get(existing.id) as any;
        const metrics = db.prepare('SELECT * FROM project_metrics WHERE project_id = ?').get(existing.id) as any;
        
        let response = structurePreview;
        response += ` **Workspace Set: ${existing.name}**\n\n`;
        response += ` **Path:** ${projectPath}\n`;
        response += ` **Tech Stack:** ${Array.isArray(existing.techStack) ? existing.techStack.join(', ') : existing.techStack}\n\n`;
        
        if (deps?.count > 0) response += ` ${deps.count} dependencies tracked\n`;
        if (envVars?.count > 0) response += ` ${envVars.count} required env vars\n`;
        if (services?.count > 0) response += ` ${services.count} service(s)\n`;
        if (databases?.count > 0) response += ` ${databases.count} database(s)\n`;
        if (metrics) response += ` ${metrics.lines_of_code.toLocaleString()} LOC, ${metrics.file_count} files\n`;
        
        response += `\n **Project context loaded. Use \`recall\` to see what you were working on.**`;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      }

      // NEW PROJECT - Run optimized deep analysis (3-layer architecture)
      console.error(' Running optimized project detection (first time)...');
      const analysis = await ProjectProfiler.analyze(projectPath);

      // Create new project
      const project = this.storage.createProject(
        path.basename(projectPath),
        projectPath
      );
      
      this.storage.updateProject(project.id, {
        architecture: analysis.architecture,
        techStack: analysis.techStack,
        updatedAt: new Date()
      });

      // Store enhanced identity data
      const db = this.storage.getDb();
      const timestamp = Date.now();

      // Dependencies
      for (const dep of analysis.dependencies) {
        db.prepare(`
          INSERT INTO project_dependencies (id, project_id, name, version, critical, dev)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), project.id, dep.name, dep.version, dep.critical ? 1 : 0, dep.dev ? 1 : 0);
      }

      // Build system
      db.prepare(`
        INSERT OR REPLACE INTO project_build_system (project_id, type, commands, config_file)
        VALUES (?, ?, ?, ?)
      `).run(project.id, analysis.buildSystem.type, JSON.stringify(analysis.buildSystem.commands), analysis.buildSystem.configFile);

      // Test framework
      if (analysis.testFramework) {
        db.prepare(`
          INSERT OR REPLACE INTO project_test_framework (project_id, name, pattern, config_file, coverage)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          project.id,
          analysis.testFramework.name,
          analysis.testFramework.pattern,
          analysis.testFramework.configFile || null,
          analysis.testFramework.coverage
        );
      }

      // Environment variables
      for (const varName of analysis.envVars.required) {
        db.prepare(`
          INSERT INTO project_env_vars (id, project_id, var_name, required, example_value)
          VALUES (?, ?, ?, 1, ?)
        `).run(randomUUID(), project.id, varName, analysis.envVars.example[varName] || null);
      }
      for (const varName of analysis.envVars.optional) {
        if (!analysis.envVars.required.includes(varName)) {
          db.prepare(`
            INSERT INTO project_env_vars (id, project_id, var_name, required, example_value)
            VALUES (?, ?, ?, 0, ?)
          `).run(randomUUID(), project.id, varName, analysis.envVars.example[varName] || null);
        }
      }

      // Services
      for (const service of analysis.services) {
        db.prepare(`
          INSERT INTO project_services (id, project_id, name, port, protocol, health_check)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), project.id, service.name, service.port, service.protocol, service.healthCheck || null);
      }

      // Databases
      for (const database of analysis.databases) {
        db.prepare(`
          INSERT INTO project_databases (id, project_id, type, connection_var, migrations, migrations_path)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          project.id,
          database.type,
          database.connectionVar || null,
          database.migrations ? 1 : 0,
          database.migrationsPath || null
        );
      }

      // Metrics
      db.prepare(`
        INSERT OR REPLACE INTO project_metrics (project_id, lines_of_code, file_count, last_commit, contributors, hotspots, complexity, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        project.id,
        analysis.metrics.linesOfCode,
        analysis.metrics.fileCount,
        '', // lastCommit - empty string instead of null
        0, // contributors - 0 instead of null
        '[]', // hotspots - empty array
        analysis.metrics.complexity,
        timestamp
      );

      // Set as current session project
      this.currentProjectId = project.id;

      // Generate comprehensive response
      let response = structurePreview;
      response += ` **Project Initialized: ${project.name}**\n\n`;
      response += ` **Scan time:** ${analysis.scanTimeMs}ms\n\n`;
      
      response += `  **Architecture:** ${analysis.architecture}\n`;
      response += ` **Tech Stack:** ${analysis.techStack.join(', ')}\n\n`;
      
      // Dependencies summary
      const criticalDeps = analysis.dependencies.filter(d => d.critical && !d.dev);
      if (criticalDeps.length > 0) {
        response += ` **Core Dependencies** (${criticalDeps.length}):\n`;
        criticalDeps.slice(0, 5).forEach(d => {
          response += `    ${d.name}@${d.version}\n`;
        });
        if (criticalDeps.length > 5) {
          response += `   ... and ${criticalDeps.length - 5} more\n`;
        }
        response += `\n`;
      }
      
      // Build system
      if (analysis.buildSystem.type !== 'unknown') {
        response += ` **Build System:** ${analysis.buildSystem.type}\n`;
        if (analysis.buildSystem.commands.build) {
          response += `   Build: \`${analysis.buildSystem.commands.build}\`\n`;
        }
        if (analysis.buildSystem.commands.test) {
          response += `   Test: \`${analysis.buildSystem.commands.test}\`\n`;
        }
        response += `\n`;
      }
      
      // Test framework
      if (analysis.testFramework) {
        response += ` **Testing:** ${analysis.testFramework.name}`;
        if (analysis.testFramework.coverage !== null) {
          response += ` (${analysis.testFramework.coverage}% coverage)`;
        }
        response += `\n\n`;
      }
      
      // Environment variables
      if (analysis.envVars.required.length > 0) {
        response += ` **Required Env Vars:** ${analysis.envVars.required.slice(0, 3).join(', ')}`;
        if (analysis.envVars.required.length > 3) {
          response += ` +${analysis.envVars.required.length - 3} more`;
        }
        response += `\n\n`;
      }
      
      // Services
      if (analysis.services.length > 0) {
        response += ` **Services:**\n`;
        analysis.services.forEach(s => {
          response += `    ${s.name}${s.port ? ` (port ${s.port})` : ''}\n`;
        });
        response += `\n`;
      }
      
      // Databases
      if (analysis.databases.length > 0) {
        response += ` **Databases:** ${analysis.databases.map(d => d.type).join(', ')}\n\n`;
      }
      
      // Quality metrics
      response += ` **Metrics:**\n`;
      response += `    ${analysis.metrics.linesOfCode.toLocaleString()} lines of code\n`;
      response += `    ${analysis.metrics.fileCount} files\n`;
      if (analysis.metrics.complexity !== null) {
        response += `    Complexity: ${analysis.metrics.complexity}\n`;
      }
      
      // Install git hooks for automatic context capture
      const GitHookManager = require('./git-hook-manager').GitHookManager;
      const hookManager = new GitHookManager(projectPath, this.storage.getDbPath());
      
      if (hookManager.isGitRepo()) {
        const result = hookManager.installHooks();
        if (result.success) {
          response += `\n\n **Git Hooks:** Installed ${result.installed.length} hook(s) (${result.installed.join(', ')})`;
          response += `\n   Context Sync will now automatically track commits, pushes, merges, and branch switches!`;
        } else {
          response += `\n\n **Git Hooks:** Failed to install (${result.errors.join(', ')})`;
        }
      }
      
      response += `\n\n **Deep context captured. Ready to work!**`;

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Failed to initialize project: ${error.message}\n\nStack: ${error.stack}`,
        }],
      };
    }
  }

  /**
   * Remember - Store context intentionally
   */
  private async handleRemember(args: RememberInput) {
    const project = this.requireProject();
    if ('content' in project) {
      return project;
    }

    const { type, content, metadata } = args;

    try {
      // Use optimized remember engine with git integration
      const engine = new RememberEngine(
        this.storage.getDb(),
        project.id,
        project.path || process.cwd()
      );
      const result = await engine.remember({ type, content, metadata });

      // Format response based on action
      let response = '';
      
      if (result.action === 'created') {
        response = ` **Remembered as ${type}**\n\n`;
        response += `"${content}"\n\n`;
        
        // Show auto-extracted metadata
        if (metadata?.files && metadata.files.length > 0) {
          response += ` **Files:** ${metadata.files.join(', ')}\n`;
        }
        
        // Show file context from auto-enrichment
        if (result.fileContext && result.fileContext.files.length > 0) {
          response += `\n **File Context:**\n`;
          for (const file of result.fileContext.files) {
            const complexityEmoji = file.complexity === 'low' ? '' : 
                                   file.complexity === 'medium' ? '' : 
                                   file.complexity === 'high' ? '' : '';
            response += `   ${file.path.split(/[/\\]/).pop()} ${complexityEmoji} ${file.complexity} (${file.linesOfCode} LOC`;
            if (file.imports.length > 0) {
              response += `, imports: ${file.imports.slice(0, 3).join(', ')}`;
            }
            response += `)\n`;
          }
          response += `\n`;
        }
        
        if (result.gitContext) {
          response += ` **Branch:** ${result.gitContext.branch}\n`;
          if (result.gitContext.uncommittedFiles.length > 0) {
            response += ` **Uncommitted:** ${result.gitContext.uncommittedFiles.length} file(s)\n`;
          }
        } else if (metadata?.branch) {
          response += ` **Branch:** ${metadata.branch}\n`;
        }
        if (metadata?.target_date) {
          response += ` **Target:** ${metadata.target_date}\n`;
        }

        if (result.conflictResult?.hasConflict) {
          response += `\n **Conflict Warning** (${result.conflictResult.conflicts.length})\n`;
          result.conflictResult.conflicts.forEach(conflict => {
            response += `   [${conflict.severity.toUpperCase()}] ${conflict.reason}\n`;
          });
          response += `\n Stored anyway so the conflict is available in recall.\n`;
        }
        
        // Show Notion suggestions if detected
        if (metadata?.notionPages && metadata.notionPages.length > 0) {
          response += `\n **Notion References Detected:**\n`;
          for (const page of metadata.notionPages) {
            response += `   ${page}\n`;
          }
          response += `\n Tip: Use \`notion action=read pageId=<id>\` to view content\n`;
        } else if (metadata?.suggestNotionSearch && metadata?.notionSearchSuggestion) {
          response += `\n **Documentation Mentioned!**\n`;
          response += ` Search Notion: \`notion action=search query="${metadata.notionSearchSuggestion}"\`\n`;
        }
        
        response += `\n This will be available in future sessions via \`recall\`.`;
      } else if (result.action === 'updated') {
        response = ` **Updated existing ${type}**\n\n`;
        response += `"${content}"\n\n`;
        
        // Show file context from auto-enrichment
        if (result.fileContext && result.fileContext.files.length > 0) {
          response += ` **File Context:**\n`;
          for (const file of result.fileContext.files) {
            const complexityEmoji = file.complexity === 'low' ? '' : 
                                   file.complexity === 'medium' ? '' : 
                                   file.complexity === 'high' ? '' : '';
            response += `   ${file.path.split(/[/\\]/).pop()} ${complexityEmoji} ${file.complexity} (${file.linesOfCode} LOC)\n`;
          }
          response += `\n`;
        }
        
        if (result.gitContext) {
          response += ` **Branch:** ${result.gitContext.branch}\n`;
        }
        response += ` Found similar context and updated it instead of creating duplicate.`;
      } else {
        response = ` **Skipped ${type}**\n\n`;
        response += `Reason: ${result.reason}`;
      }

      return textResponse(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(` Failed to remember: ${message}`);
    }
  }

  /**
   * Recall - Retrieve layered context
   */
  private async handleRecall(args?: { query?: string; limit?: number }) {
    const project = this.requireProject();
    if ('content' in project) {
      return project;
    }

    const limit = args?.limit || 10;
    const query = args?.query;
    const db = this.storage.getDb();

    try {
      // Use optimized recall engine
      const engine = new RecallEngine(db, project.id);
      const synthesis = await engine.recall(query, limit);

      // Format intelligent response
      let response = ` **Context Recall: ${project.name}**\n\n`;
      
      // 1. Smart Summary (2 paragraphs)
      response += ` **Where You Left Off**\n\n`;
      response += synthesis.summary;
      response += `\n\n`;

      // 2. Critical Path (ordered next steps)
      if (synthesis.criticalPath.length > 0) {
        response += ` **Critical Path** (in order):\n`;
        synthesis.criticalPath.forEach((step, i) => {
          response += `   ${i + 1}. ${step}\n`;
        });
        response += `\n`;
      }

      // 3. Freshness indicator
      const { fresh, recent, stale, expired } = synthesis.freshness;
      const total = fresh + recent + stale + expired;
      if (total > 0) {
        response += ` **Context Freshness**: `;
        const parts = [];
        if (fresh > 0) parts.push(`${fresh} fresh`);
        if (recent > 0) parts.push(`${recent} recent`);
        if (stale > 0) parts.push(`${stale} stale`);
        if (expired > 0) parts.push(`${expired} expired`);
        response += parts.join(', ');
        response += `\n\n`;
      }

      // 4. Active Work
      if (synthesis.activeWork.length > 0) {
        response += ` **Active Work**\n`;
        synthesis.activeWork.forEach((work: any) => {
          const freshness = work.staleness === 'fresh' ? '' : work.staleness === 'recent' ? '' : '';
          response += `${freshness} ${work.content}\n`;
          if (work.metadata?.files && work.metadata.files.length > 0) {
            response += `   Files: ${work.metadata.files.join(', ')}\n`;
          }
        });
        response += `\n`;
      }

      // 4.5. Caveats (AI mistakes, tech debt, unverified changes) - HIGH PRIORITY!
      if (synthesis.caveats.length > 0) {
        response += ` **Tech Debt & Unresolved Issues** (${synthesis.caveats.length})\n`;
        synthesis.caveats.forEach((cav: any) => {
          // Severity icons
          const severityIcon = cav.metadata?.severity === 'critical' ? '' : 
                              cav.metadata?.severity === 'high' ? '' : 
                              cav.metadata?.severity === 'medium' ? '' : '';
          
          // Category badges
          const categoryBadge = cav.metadata?.category === 'mistake' ? '[MISTAKE]' :
                               cav.metadata?.category === 'shortcut' ? '[SHORTCUT]' :
                               cav.metadata?.category === 'unverified' ? '[UNVERIFIED]' :
                               cav.metadata?.category === 'assumption' ? '[ASSUMPTION]' : '[WORKAROUND]';
          
          response += `${severityIcon} ${categoryBadge} ${cav.content}\n`;
          
          if (cav.metadata?.attempted) {
            response += `   Attempted: ${cav.metadata.attempted}\n`;
          }
          if (cav.metadata?.recovery) {
            response += `   Recovery: ${cav.metadata.recovery}\n`;
          }
          if (cav.metadata?.action_required) {
            response += `    Action Required: ${cav.metadata.action_required}\n`;
          }
          if (cav.metadata?.affects_production) {
            response += `     Affects Production: YES\n`;
          }
        });
        response += `\n`;
      }

      // 5. Open Problems
      if (synthesis.problems.length > 0) {
        response += ` **Open Problems**\n`;
        synthesis.problems.slice(0, 3).forEach((p: any) => {
          response += ` ${p.content}\n`;
        });
        if (synthesis.problems.length > 3) {
          response += `   ... and ${synthesis.problems.length - 3} more\n`;
        }
        response += `\n`;
      }

      // 6. Constraints
      if (synthesis.constraints.length > 0) {
        response += ` **Constraints**\n`;
        synthesis.constraints.slice(0, 3).forEach((c: any) => {
          response += ` ${c.content}\n`;
        });
        response += `\n`;
      }

      // 7. Goals
      if (synthesis.goals.length > 0) {
        response += ` **Goals**\n`;
        synthesis.goals.slice(0, 3).forEach((g: any) => {
          response += ` ${g.content}`;
          if (g.metadata?.status) {
            response += ` [${g.metadata.status}]`;
          }
          response += `\n`;
        });
        response += `\n`;
      }

      // 7.5. Conflicts detected
      if (synthesis.conflictResult?.hasConflict) {
        response += ` **Conflicts Detected** (${synthesis.conflictResult.conflicts.length})\n`;
        synthesis.conflictResult.conflicts.forEach(conflict => {
          response += ` [${conflict.severity.toUpperCase()}] ${conflict.reason}\n`;
        });
        response += `\n`;
      }

      // 8. Relationships (decision  files)
      if (synthesis.relationships.size > 0) {
        response += ` **Relationships**\n`;
        let count = 0;
        for (const [decision, files] of synthesis.relationships) {
          if (count >= 2) break;
          response += ` "${decision}" affects: ${files.join(', ')}\n`;
          count++;
        }
        response += `\n`;
      }

      // 9. Gaps (missing context)
      if (synthesis.gaps.length > 0) {
        response += ` **Context Gaps**\n`;
        synthesis.gaps.forEach(gap => {
          response += `${gap}\n`;
        });
        response += `\n`;
      }

      // 10. Suggestions (actionable next steps)
      if (synthesis.suggestions.length > 0) {
        response += ` **Suggestions**\n`;
        synthesis.suggestions.forEach(suggestion => {
          response += ` ${suggestion}\n`;
        });
        response += `\n`;
      }

      // Empty state
      if (total === 0) {
        response += `\n_No context stored yet. Use \`remember\` to add important information._`;
      }

      return textResponse(response);
    } catch (error: unknown) {
      return stackErrorResponse(' Failed to recall', error);
    }
  }

  /**
   * Read file from workspace
   */
  private async handleReadFile(args: { path: string }) {
    const handler = new WorkspaceToolHandler(() => this.requireWorkspace());
    return await handler.handleReadFile(args);
  }

  /**
   * Search workspace (unified search for files and content)
   */
  private async handleSearch(args: { query: string; type: 'files' | 'content'; options?: any }) {
    const handler = new WorkspaceToolHandler(() => this.requireWorkspace());
    return await handler.handleSearch(args as SearchToolArgs);
  }

  /**
   * Get project structure with complexity analysis
   */
  private async handleStructure(args?: { depth?: number }) {
    const handler = new WorkspaceToolHandler(() => this.requireWorkspace());
    return await handler.handleStructure(args);
  }

  /**
   * Git operations dispatcher (namespaced tool)
   */
  private async handleGit(args: { 
    action: 'status' | 'context' | 'hotspots' | 'coupling' | 'blame' | 'analysis'; 
    staged?: boolean; 
    files?: string[]; 
    path?: string;
    limit?: number;
    minCoupling?: number;
  }) {
    const handler = new GitToolHandler(() => this.requireWorkspace());
    return await handler.handle(args as GitToolArgs);
  }

  private async handleNotion(args: { action: 'search' | 'read'; query?: string; pageId?: string }) {
    const handler = new NotionToolHandler(this.notionHandlers);
    return await handler.handle(args as NotionToolArgs);
  }

  // ========== HELPERS ==========

  private getCurrentProject() {
    if (!this.currentProjectId) return null;
    return this.storage.getProject(this.currentProjectId);
  }

  private requireProject(): ProjectContext | ToolResponse {
    const project = this.getCurrentProject();
    return project ?? errorResponse(' No project initialized. Run `set_project` first.');
  }

  private requireWorkspace(): string | ToolResponse {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    return workspace ?? errorResponse(' No workspace set. Run `set_project` first.');
  }

  private parseKeyValue(content: string): { key: string; value: string } {
    // Try to parse "Key: Value" or "Key = Value" format
    const match = content.match(/^(.+?)[:=](.+)$/);
    if (match) {
      return {
        key: match[1].trim(),
        value: match[2].trim()
      };
    }
    // Fallback: use content as key
    return {
      key: content,
      value: ''
    };
  }

  async run(): Promise<void> {
    await this.initializeNotion();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  close(): void {
    this.workspaceDetector.dispose();
    this.storage.close();
  }
}


