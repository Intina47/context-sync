/**
 * Optimized Recall Engine
 * The 80% impact tool - transforms raw context into actionable intelligence
 */

import type { Database } from 'better-sqlite3';

interface ContextItem {
  type: 'active_work' | 'constraint' | 'problem' | 'goal' | 'decision' | 'note' | 'caveat';
  content: string;
  timestamp: number;
  metadata?: any;
  relevance?: number;
  staleness?: 'fresh' | 'recent' | 'stale' | 'expired';
}

interface RecallSynthesis {
  summary: string; // 2-paragraph "where you left off"
  criticalPath: string[]; // Ordered next steps
  activeWork: ContextItem[];
  constraints: ContextItem[];
  problems: ContextItem[];
  goals: ContextItem[];
  decisions: ContextItem[];
  notes: ContextItem[];
  caveats: ContextItem[]; // AI mistakes, tech debt
  relationships: Map<string, string[]>; // decision → affected files
  gaps: string[]; // Missing context warnings
  suggestions: string[]; // Concrete next actions
  freshness: {
    fresh: number;
    recent: number;
    stale: number;
    expired: number;
  };
}

export class OptimizedRecallEngine {
  private db: Database;
  private projectId: string;

  constructor(db: Database, projectId: string) {
    this.db = db;
    this.projectId = projectId;
  }

  /**
   * Generate intelligent context recall with synthesis
   */
  async recall(query?: string, limit: number = 10): Promise<RecallSynthesis> {
    // 1. Gather all context
    const context = await this.gatherContext(limit);

    // 2. Analyze freshness
    this.analyzeFreshness(context);

    // 3. Rank by relevance
    this.rankByRelevance(context, query);

    // 4. Build relationships
    const relationships = this.buildRelationships(context);

    // 5. Detect gaps
    const gaps = this.detectGaps(context);

    // 6. Generate summary
    const summary = this.generateSummary(context);

    // 7. Extract critical path
    const criticalPath = this.extractCriticalPath(context);

    // 8. Generate suggestions
    const suggestions = this.generateSuggestions(context, gaps);

    // 9. Calculate freshness stats
    const freshness = this.calculateFreshness(context);

    return {
      summary,
      criticalPath,
      activeWork: context.filter(c => c.type === 'active_work'),
      constraints: context.filter(c => c.type === 'constraint'),
      problems: context.filter(c => c.type === 'problem'),
      goals: context.filter(c => c.type === 'goal'),
      decisions: context.filter(c => c.type === 'decision'),
      notes: context.filter(c => c.type === 'note'),
      caveats: context.filter(c => c.type === 'caveat'),
      relationships,
      gaps,
      suggestions,
      freshness
    };
  }

  /**
   * Gather all context from database
   */
  private async gatherContext(limit: number): Promise<ContextItem[]> {
    const context: ContextItem[] = [];

    // Active work
    const activeWork = this.db.prepare(`
      SELECT * FROM active_work 
      WHERE project_id = ? AND status = 'active'
      ORDER BY timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    activeWork.forEach(work => {
      context.push({
        type: 'active_work',
        content: work.task,
        timestamp: work.timestamp,
        metadata: {
          files: work.files ? JSON.parse(work.files) : [],
          branch: work.branch,
          status: work.status
        }
      });
    });

    // Constraints
    const constraints = this.db.prepare(`
      SELECT * FROM constraints 
      WHERE project_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    constraints.forEach(c => {
      context.push({
        type: 'constraint',
        content: `${c.key}: ${c.value}`,
        timestamp: c.timestamp,
        metadata: { reasoning: c.reasoning }
      });
    });

    // Problems
    const problems = this.db.prepare(`
      SELECT * FROM problems 
      WHERE project_id = ? AND status = 'open'
      ORDER BY timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    problems.forEach(p => {
      context.push({
        type: 'problem',
        content: p.description,
        timestamp: p.timestamp,
        metadata: {
          context: p.context ? JSON.parse(p.context) : null,
          status: p.status
        }
      });
    });

    // Goals
    const goals = this.db.prepare(`
      SELECT * FROM goals 
      WHERE project_id = ? AND status IN ('planned', 'in-progress')
      ORDER BY timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    goals.forEach(g => {
      context.push({
        type: 'goal',
        content: g.description,
        timestamp: g.timestamp,
        metadata: {
          targetDate: g.target_date,
          status: g.status
        }
      });
    });

    // Decisions
    const decisions = this.db.prepare(`
      SELECT * FROM decisions 
      WHERE project_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    decisions.forEach(d => {
      context.push({
        type: 'decision',
        content: d.description,
        timestamp: d.timestamp,
        metadata: {
          reasoning: d.reasoning,
          alternatives: d.alternatives ? JSON.parse(d.alternatives) : []
        }
      });
    });

    // Notes
    const notes = this.db.prepare(`
      SELECT * FROM notes 
      WHERE project_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    notes.forEach(n => {
      context.push({
        type: 'note',
        content: n.content,
        timestamp: n.timestamp,
        metadata: { tags: n.tags }
      });
    });

    // Caveats (AI mistakes, tech debt) - Only fetch unresolved ones
    const caveats = this.db.prepare(`
      SELECT * FROM caveats 
      WHERE project_id = ? AND resolved = 0
      ORDER BY severity DESC, timestamp DESC LIMIT ?
    `).all(this.projectId, limit) as any[];

    caveats.forEach(c => {
      context.push({
        type: 'caveat',
        content: c.description,
        timestamp: c.timestamp,
        metadata: {
          category: c.category,
          severity: c.severity,
          attempted: c.attempted,
          error: c.error,
          recovery: c.recovery,
          verified: c.verified === 1,
          action_required: c.action_required,
          affects_production: c.affects_production === 1
        }
      });
    });

    return context;
  }

  /**
   * Analyze freshness of each context item
   */
  private analyzeFreshness(context: ContextItem[]): void {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    context.forEach(item => {
      const age = now - item.timestamp;

      if (age < 4 * HOUR) {
        item.staleness = 'fresh'; // Last 4 hours
      } else if (age < 2 * DAY) {
        item.staleness = 'recent'; // Last 2 days
      } else if (age < 7 * DAY) {
        item.staleness = 'stale'; // Last week
      } else {
        item.staleness = 'expired'; // Older than a week
      }
    });
  }

  /**
   * Rank by relevance (not just chronology)
   */
  private rankByRelevance(context: ContextItem[], query?: string): void {
    context.forEach(item => {
      let score = 0;

      // Recency bonus
      const age = Date.now() - item.timestamp;
      const dayAge = age / (24 * 60 * 60 * 1000);
      score += Math.max(0, 10 - dayAge); // 10 points if today, decreases

      // Type priority
      const typePriority: Record<ContextItem['type'], number> = {
        'active_work': 10,
        'caveat': 9, // High priority - unresolved tech debt!
        'problem': 8,
        'goal': 7,
        'constraint': 6,
        'decision': 5,
        'note': 3
      };
      score += typePriority[item.type];

      // Query match bonus
      if (query) {
        const queryLower = query.toLowerCase();
        const contentLower = item.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
          score += 15; // Big bonus for query match
        }
      }

      item.relevance = score;
    });

    // Sort by relevance
    context.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }

  /**
   * Build relationship graph (decisions → files, problems → constraints)
   */
  private buildRelationships(context: ContextItem[]): Map<string, string[]> {
    const relationships = new Map<string, string[]>();

    context.forEach(item => {
      if (item.type === 'decision' || item.type === 'active_work') {
        const files = item.metadata?.files || [];
        if (files.length > 0) {
          relationships.set(item.content, files);
        }
      }
    });

    return relationships;
  }

  /**
   * Detect gaps in context
   */
  private detectGaps(context: ContextItem[]): string[] {
    const gaps: string[] = [];

    const hasActiveWork = context.some(c => c.type === 'active_work');
    const hasGoals = context.some(c => c.type === 'goal');
    const hasConstraints = context.some(c => c.type === 'constraint');
    const hasProblems = context.some(c => c.type === 'problem');

    if (!hasActiveWork) {
      gaps.push('⚠️ No active work tracked - what are you currently working on?');
    }

    if (!hasGoals) {
      gaps.push('⚠️ No goals defined - what are you trying to achieve?');
    }

    if (hasProblems && !hasConstraints) {
      gaps.push('⚠️ Problems exist but no constraints documented - consider adding architectural constraints');
    }

    // Check for stale context
    const staleItems = context.filter(c => c.staleness === 'expired');
    if (staleItems.length > context.length / 2) {
      gaps.push('⚠️ Most context is >1 week old - consider updating or archiving');
    }

    return gaps;
  }

  /**
   * Generate 2-paragraph summary
   */
  private generateSummary(context: ContextItem[]): string {
    const activeWork = context.filter(c => c.type === 'active_work' && c.staleness === 'fresh');
    const problems = context.filter(c => c.type === 'problem');
    const goals = context.filter(c => c.type === 'goal');
    const recentDecisions = context.filter(c => c.type === 'decision' && c.staleness !== 'expired').slice(0, 2);

    let summary = '';

    // Paragraph 1: Current state
    if (activeWork.length > 0) {
      summary += `You're currently ${activeWork.length === 1 ? 'working on' : 'juggling'} `;
      summary += activeWork.slice(0, 2).map(w => `"${w.content}"`).join(' and ');
      if (activeWork.length > 2) summary += ` plus ${activeWork.length - 2} other task(s)`;
      summary += '. ';
    } else {
      summary += 'No active work tracked recently. ';
    }

    if (problems.length > 0) {
      summary += `You're facing ${problems.length} open problem(s), `;
      summary += `most critical: "${problems[0].content}". `;
    }

    // Paragraph 2: Context and direction
    summary += '\n\n';

    if (goals.length > 0) {
      summary += `Your current goal is to ${goals[0].content}. `;
    }

    if (recentDecisions.length > 0) {
      summary += `Recently decided: ${recentDecisions.map(d => d.content).join('; ')}. `;
    }

    if (summary.trim() === '\n\n') {
      summary = 'This is a fresh start - no recent context found. Consider using `remember` to document your current work, goals, and constraints.';
    }

    return summary.trim();
  }

  /**
   * Extract critical path (ordered next steps)
   */
  private extractCriticalPath(context: ContextItem[]): string[] {
    const path: string[] = [];

    // 1. Unblocked active work
    const activeWork = context.filter(c => c.type === 'active_work' && c.staleness !== 'expired');
    if (activeWork.length > 0) {
      path.push(`Continue: ${activeWork[0].content}`);
    }

    // 2. Open problems blocking progress
    const criticalProblems = context.filter(c => c.type === 'problem');
    if (criticalProblems.length > 0) {
      path.push(`Fix: ${criticalProblems[0].content}`);
    }

    // 3. In-progress goals
    const activeGoals = context.filter(c => c.type === 'goal' && c.metadata?.status === 'in-progress');
    if (activeGoals.length > 0 && path.length < 3) {
      path.push(`Achieve: ${activeGoals[0].content}`);
    }

    // 4. Planned goals
    const plannedGoals = context.filter(c => c.type === 'goal' && c.metadata?.status === 'planned');
    if (plannedGoals.length > 0 && path.length < 3) {
      path.push(`Next: ${plannedGoals[0].content}`);
    }

    return path;
  }

  /**
   * Generate actionable suggestions with cross-tool intelligence
   */
  private generateSuggestions(context: ContextItem[], gaps: string[]): string[] {
    const suggestions: string[] = [];

    // Based on active work
    const activeWork = context.filter(c => c.type === 'active_work');
    if (activeWork.length > 0) {
      const work = activeWork[0];
      if (work.metadata?.files && work.metadata.files.length > 0) {
        suggestions.push(`Review ${work.metadata.files[0]} related to: ${work.content}`);
      }

      // Notion integration: suggest documentation search
      if (this.mentionsDocumentation(work.content)) {
        const keywords = this.extractKeywords(work.content);
        suggestions.push(`📚 Search Notion docs: notion action=search query="${keywords}"`);
      }
    }

    // Based on decisions
    const recentDecisions = context.filter(c => c.type === 'decision').slice(0, 2);
    if (recentDecisions.length > 0) {
      const decision = recentDecisions[0];
      if (this.mentionsArchitecture(decision.content)) {
        suggestions.push(`📐 Find architecture docs: notion action=search query="architecture"`);
      }
    }

    // Based on constraints
    const constraints = context.filter(c => c.type === 'constraint');
    if (constraints.length > 0 && this.mentionsDocumentation(constraints[0].content)) {
      suggestions.push(`📖 Check constraint documentation in Notion`);
    }

    // Based on problems
    const problems = context.filter(c => c.type === 'problem');
    if (problems.length > 0) {
      suggestions.push(`Research solution for: ${problems[0].content}`);
      
      // Suggest searching Notion for similar issues
      const keywords = this.extractKeywords(problems[0].content);
      if (keywords) {
        suggestions.push(`🔍 Search past solutions: notion action=search query="${keywords}"`);
      }
    }

    // Based on gaps
    if (gaps.length > 0) {
      suggestions.push('Run `remember` to update your current context');
    }

    return suggestions;
  }

  /**
   * Detect if content mentions documentation/architecture concepts
   */
  private mentionsDocumentation(content: string): boolean {
    const docKeywords = [
      'documentation', 'docs', 'design doc', 'architecture', 'specification',
      'guide', 'manual', 'reference', 'readme', 'wiki', 'adr', 'rfc'
    ];
    const lower = content.toLowerCase();
    return docKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Detect if content mentions architecture concepts
   */
  private mentionsArchitecture(content: string): boolean {
    const archKeywords = [
      'architecture', 'design', 'pattern', 'microservice', 'monolith',
      'api', 'database', 'infrastructure', 'system design', 'scalability'
    ];
    const lower = content.toLowerCase();
    return archKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Extract meaningful keywords for Notion search
   */
  private extractKeywords(content: string): string {
    // Remove common words and extract meaningful terms
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on'];
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.includes(w));
    
    // Return first 2-3 meaningful words
    return words.slice(0, 3).join(' ');
  }

  /**
   * Calculate freshness statistics
   */
  private calculateFreshness(context: ContextItem[]): RecallSynthesis['freshness'] {
    const fresh = context.filter(c => c.staleness === 'fresh').length;
    const recent = context.filter(c => c.staleness === 'recent').length;
    const stale = context.filter(c => c.staleness === 'stale').length;
    const expired = context.filter(c => c.staleness === 'expired').length;

    return { fresh, recent, stale, expired };
  }
}
