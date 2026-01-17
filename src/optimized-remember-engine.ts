/**
 * Optimized Remember Engine
 * Smart context storage with auto-detection, deduplication, and validation
 * Auto-enriches with git context AND file context (complexity, imports, relationships)
 */

import type { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import simpleGit from 'simple-git';
import { OptimizedReadFileEngine } from './optimized-readfile-engine.js';

interface RememberInput {
  type: 'active_work' | 'constraint' | 'problem' | 'goal' | 'decision' | 'note' | 'caveat';
  content: string;
  metadata?: Record<string, any>;
}

interface RememberResult {
  action: 'created' | 'updated' | 'skipped';
  id: string;
  type: string;
  reason?: string;
  gitContext?: {
    branch: string;
    uncommittedFiles: string[];
    stagedFiles: string[];
    lastCommit: string;
  };
  fileContext?: {
    files: Array<{
      path: string;
      complexity: string;
      linesOfCode: number;
      imports: string[];
    }>;
  };
}

export class OptimizedRememberEngine {
  private db: Database;
  private projectId: string;
  private projectPath: string;
  private readFileEngine: OptimizedReadFileEngine;

  constructor(db: Database, projectId: string, projectPath: string) {
    this.db = db;
    this.projectId = projectId;
    this.projectPath = projectPath;
    this.readFileEngine = new OptimizedReadFileEngine(projectPath);
  }

  /**
   * Remember context intelligently
   */
  async remember(input: RememberInput): Promise<RememberResult> {
    // 1. Validate content
    const validation = this.validateContent(input);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // 2. Fetch git context to enrich metadata
    const gitContext = await this.fetchGitContext();

    // 3. Auto-enhance metadata with content + git info
    input.metadata = await this.enhanceMetadata(input, gitContext);

    // 4. Enrich with file context (complexity, imports, relationships)
    let fileContext: RememberResult['fileContext'];
    if (input.metadata.files && input.metadata.files.length > 0) {
      fileContext = await this.enrichWithFileContext(input.metadata.files);
      
      // Store file context in metadata for later retrieval
      if (fileContext && fileContext.files.length > 0) {
        input.metadata.fileContext = fileContext.files;
      }
    }

    // 5. Check for duplicates/updates
    const existing = this.findSimilar(input);
    if (existing) {
      // Update existing instead of creating duplicate
      return this.updateExisting(existing, input, gitContext, fileContext);
    }

    // 6. Store new context
    return this.storeNew(input, gitContext, fileContext);
  }

  /**
   * Fetch git context (branch, changes, status)
   */
  private async fetchGitContext(): Promise<RememberResult['gitContext'] | null> {
    try {
      const git = simpleGit(this.projectPath);
      const status = await git.status();
      const log = await git.log({ maxCount: 1 });

      return {
        branch: status.current || 'unknown',
        uncommittedFiles: [
          ...status.modified,
          ...status.created,
          ...status.deleted,
          ...status.renamed.map(r => r.to)
        ],
        stagedFiles: status.staged,
        lastCommit: log.latest?.message || 'No commits'
      };
    } catch (error) {
      // Not a git repo or git error
      return null;
    }
  }

  /**
   * Validate content is meaningful
   */
  private validateContent(input: RememberInput): { valid: boolean; reason?: string } {
    const content = input.content.trim();

    // Too short
    if (content.length < 10) {
      return { valid: false, reason: 'Content too short - be more specific (minimum 10 characters)' };
    }

    // Too vague
    const vaguePatterns = [
      /^(this|that|it|the thing)$/i,
      /^(todo|fix|bug|issue|task)$/i,
      /^(working on|doing|making)$/i
    ];

    for (const pattern of vaguePatterns) {
      if (pattern.test(content)) {
        return { valid: false, reason: `Too vague: "${content}". Please be specific about what you're doing.` };
      }
    }

    return { valid: true };
  }

  /**
   * Auto-enhance metadata by extracting from content + git context
   */
  private async enhanceMetadata(
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null
  ): Promise<Record<string, any>> {
    const metadata = input.metadata || {};
    const content = input.content;

    // Extract file paths from content
    if (!metadata.files) {
      const fileMatches = content.match(/\b[\w-]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|md|json|yaml|yml|toml)\b/g);
      if (fileMatches) {
        metadata.files = Array.from(new Set(fileMatches));
      }
    }

    // Extract Notion page references from content
    if (!metadata.notionPages) {
      const notionPatterns = [
        // Notion URLs: https://www.notion.so/Page-Title-123abc...
        /https:\/\/(?:www\.)?notion\.so\/[^\s]+/g,
        // Notion page IDs: 2daae57c-efce-8109-8899-f74f9054c7b7
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
      ];

      const references = new Set<string>();
      for (const pattern of notionPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(ref => references.add(ref));
        }
      }

      if (references.size > 0) {
        metadata.notionPages = Array.from(references);
      }
    }

    // Detect if content mentions documentation (suggest Notion search)
    if (!metadata.suggestNotionSearch) {
      const docKeywords = [
        'documentation', 'docs', 'design doc', 'architecture doc', 
        'specification', 'guide', 'manual', 'reference', 'adr', 'rfc'
      ];
      const lower = content.toLowerCase();
      const mentionsDocs = docKeywords.some(keyword => lower.includes(keyword));
      
      if (mentionsDocs) {
        metadata.suggestNotionSearch = true;
        // Extract meaningful keywords for search suggestion
        const keywords = this.extractSearchKeywords(content);
        if (keywords) {
          metadata.notionSearchSuggestion = keywords;
        }
      }
    }

    // Add uncommitted files from git (likely what user is working on)
    if (gitContext && (input.type === 'active_work' || input.type === 'problem')) {
      const existingFiles = metadata.files || [];
      const allFiles = new Set([
        ...existingFiles,
        ...gitContext.uncommittedFiles,
        ...gitContext.stagedFiles
      ]);
      metadata.files = Array.from(allFiles);
    }

    // Extract/use branch from git
    if (!metadata.branch && gitContext) {
      metadata.branch = gitContext.branch;
    }

    // Extract deadlines for goals
    if (input.type === 'goal' && !metadata.target_date) {
      const datePatterns = [
        /by\s+(\d{4}-\d{2}-\d{2})/i,
        /by\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i,
        /deadline[:\s]+(\d{4}-\d{2}-\d{2})/i
      ];

      for (const pattern of datePatterns) {
        const match = content.match(pattern);
        if (match) {
          metadata.target_date = match[1];
          break;
        }
      }
    }

    return metadata;
  }

  /**
   * Extract meaningful keywords for Notion search suggestion
   */
  private extractSearchKeywords(content: string): string | null {
    // Remove URLs, special chars, and extract meaningful terms
    const cleaned = content
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase();

    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on', 'that', 'this', 'we', 'i'];
    const words = cleaned
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.includes(w));
    
    // Return first 2-3 meaningful words
    const keywords = words.slice(0, 3).join(' ');
    return keywords.length > 0 ? keywords : null;
  }

  /**
   * Enrich with file context (NEW!)
   * Read files and add complexity, imports, relationships
   */
  private async enrichWithFileContext(
    files: string[]
  ): Promise<RememberResult['fileContext']> {
    const fileContexts: RememberResult['fileContext'] = { files: [] };

    // Only process first 3 files (avoid slowdown)
    const filesToProcess = files.slice(0, 3);

    for (const file of filesToProcess) {
      try {
        const fileCtx = await this.readFileEngine.read(file);
        
        fileContexts.files.push({
          path: file,
          complexity: fileCtx.complexity.level,
          linesOfCode: fileCtx.metadata.linesOfCode,
          imports: fileCtx.relationships.imports.slice(0, 5) // Top 5 imports
        });
      } catch (err) {
        // File doesn't exist or can't be read, skip
        continue;
      }
    }

    return fileContexts.files.length > 0 ? fileContexts : undefined;
  }

  /**
   * Find similar existing context
   */
  private findSimilar(input: RememberInput): any | null {
    const { type, content } = input;

    // For active_work, check if task is similar
    if (type === 'active_work') {
      const existing = this.db.prepare(`
        SELECT * FROM active_work 
        WHERE project_id = ? AND status = 'active'
        ORDER BY timestamp DESC LIMIT 5
      `).all(this.projectId) as any[];

      for (const item of existing) {
        const similarity = this.calculateSimilarity(content, item.task);
        if (similarity > 0.8) {
          return { ...item, table: 'active_work' };
        }
      }
    }

    // For constraints, check if key matches
    if (type === 'constraint') {
      const keyValue = this.parseKeyValue(content);
      const existing = this.db.prepare(`
        SELECT * FROM constraints 
        WHERE project_id = ? AND key = ?
      `).get(this.projectId, keyValue.key);

      if (existing) {
        return { ...existing, table: 'constraints' };
      }
    }

    // For goals, check if description is similar
    if (type === 'goal') {
      const existing = this.db.prepare(`
        SELECT * FROM goals 
        WHERE project_id = ? AND status IN ('planned', 'in-progress')
        ORDER BY timestamp DESC LIMIT 5
      `).all(this.projectId) as any[];

      for (const item of existing) {
        const similarity = this.calculateSimilarity(content, item.description);
        if (similarity > 0.7) {
          return { ...item, table: 'goals' };
        }
      }
    }

    return null;
  }

  /**
   * Calculate text similarity (simple word overlap)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Update existing context
   */
  private updateExisting(
    existing: any,
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null,
    fileContext?: RememberResult['fileContext']
  ): RememberResult {
    const timestamp = Date.now();
    const files = input.metadata?.files || [];
    const branch = input.metadata?.branch || gitContext?.branch || 'unknown';

    switch (existing.table) {
      case 'active_work':
        // Store file context in the context field as JSON if present
        const contextData = input.metadata?.context || existing.context;
        const enrichedContext = fileContext 
          ? JSON.stringify({ text: contextData, fileContext })
          : contextData;
        
        this.db.prepare(`
          UPDATE active_work 
          SET task = ?, context = ?, files = ?, branch = ?, timestamp = ?
          WHERE id = ?
        `).run(
          input.content,
          enrichedContext,
          JSON.stringify(files),
          branch,
          timestamp,
          existing.id
        );
        break;

      case 'constraints':
        const keyValue = this.parseKeyValue(input.content);
        this.db.prepare(`
          UPDATE constraints 
          SET value = ?, reasoning = ?, timestamp = ?
          WHERE id = ?
        `).run(
          keyValue.value,
          input.metadata?.reasoning || existing.reasoning,
          timestamp,
          existing.id
        );
        break;

      case 'goals':
        this.db.prepare(`
          UPDATE goals 
          SET description = ?, target_date = ?, timestamp = ?
          WHERE id = ?
        `).run(
          input.content,
          input.metadata?.target_date || existing.target_date,
          timestamp,
          existing.id
        );
        break;
    }

    return {
      action: 'updated',
      id: existing.id,
      type: input.type,
      reason: 'Found similar existing context and updated it',
      gitContext: gitContext || undefined,
      fileContext
    };
  }

  /**
   * Store new context
   */
  private storeNew(
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null,
    fileContext?: RememberResult['fileContext']
  ): RememberResult {
    const { type, content, metadata } = input;
    const timestamp = Date.now();
    const id = randomUUID();
    const files = metadata?.files || [];
    const branch = metadata?.branch || gitContext?.branch || 'unknown';

    switch (type) {
      case 'active_work':
        // Store file context in the context field as JSON if present
        const contextData = metadata?.context || '';
        const enrichedContext = fileContext 
          ? JSON.stringify({ text: contextData, fileContext })
          : contextData;
        
        this.db.prepare(`
          INSERT INTO active_work (id, project_id, task, context, files, branch, timestamp, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(
          id,
          this.projectId,
          content,
          enrichedContext,
          JSON.stringify(files),
          branch,
          timestamp
        );
        break;

      case 'constraint':
        const keyValue = this.parseKeyValue(content);
        this.db.prepare(`
          INSERT INTO constraints (id, project_id, key, value, reasoning, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id,
          this.projectId,
          keyValue.key,
          keyValue.value,
          metadata?.reasoning || '',
          timestamp
        );
        break;

      case 'problem':
        this.db.prepare(`
          INSERT INTO problems (id, project_id, description, context, status, timestamp)
          VALUES (?, ?, ?, ?, 'open', ?)
        `).run(
          id,
          this.projectId,
          content,
          JSON.stringify(metadata?.context || {}),
          timestamp
        );
        break;

      case 'goal':
        this.db.prepare(`
          INSERT INTO goals (id, project_id, description, target_date, status, timestamp)
          VALUES (?, ?, ?, ?, 'planned', ?)
        `).run(
          id,
          this.projectId,
          content,
          metadata?.target_date || null,
          timestamp
        );
        break;

      case 'decision':
        // Store alternatives in reasoning as JSON if provided
        const reasoning = metadata?.reasoning || '';
        const reasoningWithAlternatives = metadata?.alternatives 
          ? JSON.stringify({ reasoning, alternatives: metadata.alternatives })
          : reasoning;
        
        this.db.prepare(`
          INSERT INTO decisions (id, project_id, type, description, reasoning, timestamp)
          VALUES (?, ?, 'other', ?, ?, ?)
        `).run(
          id,
          this.projectId,
          content,
          reasoningWithAlternatives,
          timestamp
        );
        break;

      case 'note':
        this.db.prepare(`
          INSERT INTO notes (id, project_id, content, tags, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          id,
          this.projectId,
          content,
          JSON.stringify(metadata?.tags || []),
          timestamp
        );
        break;

      case 'caveat':
        // AI self-reporting mistakes and tech debt
        const category = metadata?.category || 'workaround';
        const severity = metadata?.severity || 'medium';
        const verified = metadata?.verified === true ? 1 : 0;
        const affects_production = metadata?.affects_production === true ? 1 : 0;
        
        this.db.prepare(`
          INSERT INTO caveats (
            id, project_id, description, category, severity,
            attempted, error, recovery, verified, action_required,
            affects_production, timestamp, resolved
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          id,
          this.projectId,
          content,
          category,
          severity,
          metadata?.attempted || null,
          metadata?.error || null,
          metadata?.recovery || null,
          verified,
          metadata?.action_required || null,
          affects_production,
          timestamp
        );
        break;
    }

    return {
      action: 'created',
      id,
      type,
      reason: 'Stored new context',
      gitContext: gitContext || undefined,
      fileContext
    };
  }

  /**
   * Parse "Key: Value" format
   */
  private parseKeyValue(content: string): { key: string; value: string } {
    const match = content.match(/^(.+?)[:=](.+)$/);
    if (match) {
      return {
        key: match[1].trim(),
        value: match[2].trim()
      };
    }
    // If no separator, treat whole thing as key with empty value
    return {
      key: content.trim(),
      value: ''
    };
  }
}
