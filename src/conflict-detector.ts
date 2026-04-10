import type { Database } from 'better-sqlite3';
import type { RememberInput, RememberType } from './context-layers.js';

export type ConflictSeverity = 'warning' | 'block';

export interface ConflictContextItem {
  id: string;
  type: RememberType;
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface ConflictItem {
  type: string;
  content: string;
  id: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    existingItem: ConflictItem;
    newItem: ConflictItem;
    reason: string;
    severity: ConflictSeverity;
  }>;
}

type ConflictPair = {
  existingItem: ConflictContextItem;
  newItem: ConflictContextItem;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'no',
  'not',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'without',
  'do',
  'does',
  'done',
  'dont',
  "don't",
  'never',
  'avoid',
  'must',
  'should',
  'can',
  'cannot',
  "can't",
  'will',
  "won't",
  'shouldn',
  'shouldnt',
  'need',
  'needs',
  'using',
  'use',
  'used',
  'allow',
  'allowed',
  'prefer',
  'preferred',
  'require',
  'required'
]);

const NEGATION_PATTERNS = [
  /\bno\b/i,
  /\bnever\b/i,
  /\bavoid\b/i,
  /\bdon't\b/i,
  /\bdo not\b/i,
  /\bwithout\b/i,
  /\bmust not\b/i,
  /\bcan't\b/i,
  /\bcannot\b/i,
  /\bwon't\b/i,
  /\bprohibit(?:ed|s)?\b/i,
  /\bban(?:ned|s)?\b/i
];

const POSITIVE_DIRECTIVE_PATTERNS = [
  /\buse\b/i,
  /\ballow(?:ed)?\b/i,
  /\bprefer(?:red)?\b/i,
  /\brequire(?:d)?\b/i,
  /\badopt(?:ed|ing)?\b/i,
  /\bchoose\b/i,
  /\bstandardi[sz]e\b/i
];

const SPEED_LIMIT_PATTERNS = [
  /\bshortcut(?:s)?\b/i,
  /\brush(?:ed|ing)?\b/i,
  /\bfast\b/i,
  /\bquick\b/i,
  /\bspeed\b/i,
  /\bship\b/i,
  /\bsoon\b/i,
  /\bdeadline\b/i,
  /\bthorough\b/i,
  /\bcareful\b/i,
  /\bquality\b/i
];

const URGENCY_PATTERNS = [
  /\burgent\b/i,
  /\bsoon\b/i,
  /\btoday\b/i,
  /\btomorrow\b/i,
  /\bthis week\b/i,
  /\bnext week\b/i,
  /\bthis sprint\b/i,
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bby\s+\d{4}-\d{2}-\d{2}\b/i,
  /\bby\s+\w+\s+\d{1,2}\b/i
];

export class ConflictDetector {
  constructor(private db: Database) {}

  detect(projectId: string, newItem: RememberInput): ConflictResult {
    const context = this.loadProjectContext(projectId);
    const newContextItem = this.toContextItem('new', newItem.type, newItem.content, newItem.metadata);

    return this.detectAgainstExisting(context, newContextItem);
  }

  detectInContext(items: ConflictContextItem[]): ConflictResult {
    const conflicts: ConflictResult['conflicts'] = [];
    const seen = new Set<string>();

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const pair = this.orderPair(items[i], items[j]);
        if (!pair) {
          continue;
        }

        const pairConflicts = this.comparePair(pair.existingItem, pair.newItem);
        this.pushUnique(conflicts, seen, pairConflicts);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private detectAgainstExisting(existingItems: ConflictContextItem[], newItem: ConflictContextItem): ConflictResult {
    const conflicts: ConflictResult['conflicts'] = [];
    const seen = new Set<string>();

    for (const existingItem of existingItems) {
      const pair = this.orderPair(existingItem, newItem);
      if (!pair) {
        continue;
      }

      const pairConflicts = this.comparePair(pair.existingItem, pair.newItem);
      this.pushUnique(conflicts, seen, pairConflicts);
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private loadProjectContext(projectId: string): ConflictContextItem[] {
    const items: ConflictContextItem[] = [];

    const activeWork = this.db.prepare(`
      SELECT id, task, context, branch, timestamp
      FROM active_work
      WHERE project_id = ? AND status = 'active'
      ORDER BY timestamp DESC
    `).all(projectId) as Array<{ id: string; task: string; context: string | null; branch: string | null; timestamp: number }>;

    for (const row of activeWork) {
      items.push({
        id: row.id,
        type: 'active_work',
        content: [row.task, row.context].filter(Boolean).join(' ').trim(),
        timestamp: row.timestamp,
        metadata: row.branch ? { branch: row.branch } : undefined
      });
    }

    const constraints = this.db.prepare(`
      SELECT id, key, value, reasoning, timestamp
      FROM constraints
      WHERE project_id = ?
      ORDER BY timestamp DESC
    `).all(projectId) as Array<{ id: string; key: string; value: string; reasoning: string; timestamp: number }>;

    for (const row of constraints) {
      items.push({
        id: row.id,
        type: 'constraint',
        content: `${row.key}: ${row.value}`.trim(),
        timestamp: row.timestamp,
        metadata: row.reasoning ? { reasoning: row.reasoning } : undefined
      });
    }

    const decisions = this.db.prepare(`
      SELECT id, description, reasoning, timestamp
      FROM decisions
      WHERE project_id = ?
      ORDER BY timestamp DESC
    `).all(projectId) as Array<{ id: string; description: string; reasoning: string; timestamp: number }>;

    for (const row of decisions) {
      items.push({
        id: row.id,
        type: 'decision',
        content: [row.description, row.reasoning].filter(Boolean).join(' ').trim(),
        timestamp: row.timestamp
      });
    }

    const goals = this.db.prepare(`
      SELECT id, description, target_date, timestamp, status
      FROM goals
      WHERE project_id = ? AND status IN ('planned', 'in-progress')
      ORDER BY timestamp DESC
    `).all(projectId) as Array<{ id: string; description: string; target_date: string | null; timestamp: number; status: string }>;

    for (const row of goals) {
      items.push({
        id: row.id,
        type: 'goal',
        content: row.description,
        timestamp: row.timestamp,
        metadata: {
          target_date: row.target_date,
          status: row.status
        }
      });
    }

    return items;
  }

  private comparePair(existingItem: ConflictContextItem, newItem: ConflictContextItem): ConflictResult['conflicts'] {
    if (!this.categoryConflict(existingItem.type, newItem.type)) {
      return [];
    }

    if (existingItem.type === 'constraint' && newItem.type === 'constraint') {
      return this.compareConstraints(existingItem, newItem);
    }

    if (existingItem.type === 'constraint' && (newItem.type === 'active_work' || newItem.type === 'decision')) {
      return this.compareConstraintAgainstContext(existingItem, newItem);
    }

    if (existingItem.type === 'constraint' && newItem.type === 'goal') {
      return this.compareGoalAgainstConstraint(existingItem, newItem);
    }

    return [];
  }

  private compareConstraintAgainstContext(constraint: ConflictContextItem, contextItem: ConflictContextItem): ConflictResult['conflicts'] {
    if (!this.keywordConflict(constraint.content, contextItem.content)) {
      return [];
    }

    if (!this.isNegatedConstraint(constraint.content)) {
      return [];
    }

    const overlap = this.sharedTerms(constraint.content, contextItem.content);
    if (overlap.length === 0) {
      return [];
    }

    return [{
      existingItem: this.toConflictItem(constraint),
      newItem: this.toConflictItem(contextItem),
      severity: 'block',
      reason: `Existing constraint "${this.preview(constraint.content)}" conflicts with ${contextItem.type} "${this.preview(contextItem.content)}" because of shared term(s): ${overlap.join(', ')}.`
    }];
  }

  private compareConstraints(existingConstraint: ConflictContextItem, newConstraint: ConflictContextItem): ConflictResult['conflicts'] {
    const overlap = this.sharedTerms(existingConstraint.content, newConstraint.content);
    if (overlap.length === 0) {
      return [];
    }

    if (!this.hasOpposingGuidance(existingConstraint.content, newConstraint.content)) {
      return [];
    }

    return [{
      existingItem: this.toConflictItem(existingConstraint),
      newItem: this.toConflictItem(newConstraint),
      severity: 'warning',
      reason: `Constraint "${this.preview(existingConstraint.content)}" and "${this.preview(newConstraint.content)}" give opposing guidance on ${overlap.join(', ')}.`
    }];
  }

  private compareGoalAgainstConstraint(constraint: ConflictContextItem, goal: ConflictContextItem): ConflictResult['conflicts'] {
    if (!this.isSpeedConstraint(constraint.content)) {
      return [];
    }

    if (!this.hasDeadlinePressure(goal)) {
      return [];
    }

    return [{
      existingItem: this.toConflictItem(constraint),
      newItem: this.toConflictItem(goal),
      severity: 'warning',
      reason: `Goal "${this.preview(goal.content)}" introduces deadline pressure that conflicts with the speed-limiting constraint "${this.preview(constraint.content)}".`
    }];
  }

  private keywordConflict(a: string, b: string): boolean {
    return this.sharedTerms(a, b).length > 0;
  }

  private categoryConflict(typeA: string, typeB: string): boolean {
    const allowed = new Set(['constraint', 'active_work', 'decision', 'goal']);
    return allowed.has(typeA) && allowed.has(typeB);
  }

  private orderPair(a: ConflictContextItem, b: ConflictContextItem): ConflictPair | null {
    if (!this.categoryConflict(a.type, b.type)) {
      return null;
    }

    if (a.type === 'constraint' && b.type !== 'constraint') {
      return { existingItem: a, newItem: b };
    }

    if (b.type === 'constraint' && a.type !== 'constraint') {
      return { existingItem: b, newItem: a };
    }

    if (a.type === 'constraint' && b.type === 'constraint') {
      if ((a.timestamp ?? 0) <= (b.timestamp ?? 0)) {
        return { existingItem: a, newItem: b };
      }
      return { existingItem: b, newItem: a };
    }

    return null;
  }

  private hasOpposingGuidance(a: string, b: string): boolean {
    const aNegated = this.isNegatedConstraint(a);
    const bNegated = this.isNegatedConstraint(b);
    const aPositive = this.hasPositiveDirective(a);
    const bPositive = this.hasPositiveDirective(b);

    return (aNegated && bPositive) || (bNegated && aPositive);
  }

  private isNegatedConstraint(content: string): boolean {
    return NEGATION_PATTERNS.some(pattern => pattern.test(content));
  }

  private hasPositiveDirective(content: string): boolean {
    return POSITIVE_DIRECTIVE_PATTERNS.some(pattern => pattern.test(content));
  }

  private isSpeedConstraint(content: string): boolean {
    return SPEED_LIMIT_PATTERNS.some(pattern => pattern.test(content));
  }

  private hasDeadlinePressure(item: ConflictContextItem): boolean {
    if (item.metadata) {
      if (typeof item.metadata.target_date === 'string' && item.metadata.target_date.trim().length > 0) {
        return true;
      }

      if (typeof item.metadata.targetDate === 'string' && item.metadata.targetDate.trim().length > 0) {
        return true;
      }
    }

    return URGENCY_PATTERNS.some(pattern => pattern.test(item.content));
  }

  private sharedTerms(a: string, b: string): string[] {
    const termsA = this.extractTerms(a);
    const termsB = this.extractTerms(b);
    const overlap = new Set<string>();

    for (const term of termsA) {
      if (termsB.has(term)) {
        overlap.add(term);
      }
    }

    return Array.from(overlap);
  }

  private extractTerms(content: string): Set<string> {
    const normalized = content
      .toLowerCase()
      .replace(/https?:\/\/[^\s]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ');

    const terms = new Set<string>();

    for (const rawTerm of normalized.split(/\s+/)) {
      const term = rawTerm.trim();
      if (term.length < 3) {
        continue;
      }

      if (STOP_WORDS.has(term)) {
        continue;
      }

      terms.add(term);
    }

    return terms;
  }

  private toContextItem(id: string, type: RememberType, content: string, metadata?: Record<string, any>): ConflictContextItem {
    return {
      id,
      type,
      content,
      metadata
    };
  }

  private toConflictItem(item: ConflictContextItem): ConflictItem {
    return {
      id: item.id,
      type: item.type,
      content: item.content
    };
  }

  private preview(content: string): string {
    return content.length > 80 ? `${content.slice(0, 77)}...` : content;
  }

  private pushUnique(
    target: ConflictResult['conflicts'],
    seen: Set<string>,
    conflicts: ConflictResult['conflicts']
  ): void {
    for (const conflict of conflicts) {
      const key = [
        conflict.existingItem.id,
        conflict.newItem.id,
        conflict.severity,
        conflict.reason
      ].join('::');

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      target.push(conflict);
    }
  }
}
