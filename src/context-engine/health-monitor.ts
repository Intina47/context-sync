/**
 * Context Health Monitor - Track and report on context quality
 * 
 * Solves: Knowing when context is stale, conflicting, or incomplete
 */
import { ContextItem } from './relevance-scorer.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ContextHealth {
  score: number; // 0-100
  issues: HealthIssue[];
  metrics: {
    totalItems: number;
    freshItems: number;
    staleItems: number;
    conflicts: number;
    coverage: number; // % of codebase with context
    avgRelevance: number;
  };
  recommendations: string[];
}

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'staleness' | 'conflict' | 'gap' | 'redundancy';
  description: string;
  affectedItems: string[];
  suggestion: string;
}

export class ContextHealthMonitor {
  private workspacePath: string;

  constructor(workspacePath?: string) {
    this.workspacePath = workspacePath || process.cwd();
  }
  
  async assessHealth(contexts: ContextItem[]): Promise<ContextHealth> {
    const issues: HealthIssue[] = [];
    
    // Check for stale context
    issues.push(...this.detectStaleness(contexts));
    
    // Check for conflicts
    issues.push(...this.detectConflicts(contexts));
    
    // Check for gaps
    issues.push(...this.detectGaps(contexts));
    
    // Check for redundancy
    issues.push(...this.detectRedundancy(contexts));
    
    const metrics = this.calculateMetrics(contexts, issues);
    const score = this.calculateHealthScore(metrics, issues);
    const recommendations = this.generateRecommendations(issues, metrics);
    
    return { score, issues, metrics, recommendations };
  }

  private detectStaleness(contexts: ContextItem[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const staleContexts = contexts.filter(c => c.timestamp < thirtyDaysAgo);
    
    if (staleContexts.length > contexts.length * 0.2) {
      issues.push({
        severity: 'warning',
        type: 'staleness',
        description: `${staleContexts.length} contexts are over 30 days old`,
        affectedItems: staleContexts.map(c => c.id),
        suggestion: 'Review and update or archive old contexts',
      });
    }
    
    return issues;
  }

  private detectConflicts(contexts: ContextItem[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    
    // Find contradicting decisions
    const decisions = contexts.filter(c => c.type === 'decision');
    
    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        if (this.areConflicting(decisions[i], decisions[j])) {
          issues.push({
            severity: 'critical',
            type: 'conflict',
            description: `Conflicting decisions detected`,
            affectedItems: [decisions[i].id, decisions[j].id],
            suggestion: 'Resolve conflicting decisions - which one is current?',
          });
        }
      }
    }
    
    return issues;
  }

  private detectGaps(contexts: ContextItem[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    
    try {
      const allProjectFiles = this.getAllProjectFiles();
      const filesWithContext = this.getFilesWithContext(contexts);
      const filesWithoutContext = allProjectFiles.filter(file => !filesWithContext.has(file));
      
      // Important files that should have context
      const importantFiles = this.identifyImportantFiles(allProjectFiles);
      const importantFilesWithoutContext = filesWithoutContext.filter(file => 
        importantFiles.includes(file)
      );
      
      if (importantFilesWithoutContext.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'gap',
          description: `${importantFilesWithoutContext.length} important files lack context coverage`,
          affectedItems: importantFilesWithoutContext.slice(0, 5), // Show first 5
          suggestion: 'Consider adding context for key files like entry points, main modules, and frequently modified files'
        });
      }
      
      // Check for large gaps in directories
      const directoryGaps = this.findDirectoryGaps(allProjectFiles, filesWithContext);
      for (const gap of directoryGaps) {
        issues.push({
          severity: 'info',
          type: 'gap',
          description: `Directory "${gap.directory}" has low context coverage (${gap.coverage}%)`,
          affectedItems: gap.uncoveredFiles.slice(0, 3),
          suggestion: `Add context for key files in ${gap.directory} to improve coverage`
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'warning',
        type: 'gap',
        description: 'Failed to analyze context gaps',
        affectedItems: [],
        suggestion: 'Check file system permissions and workspace structure'
      });
    }
    
    return issues;
  }

  private detectRedundancy(contexts: ContextItem[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const similarGroups: ContextItem[][] = [];
    const processed = new Set<string>();
    
    // Find groups of similar contexts
    for (let i = 0; i < contexts.length; i++) {
      if (processed.has(contexts[i].id)) continue;
      
      const similar: ContextItem[] = [contexts[i]];
      processed.add(contexts[i].id);
      
      for (let j = i + 1; j < contexts.length; j++) {
        if (processed.has(contexts[j].id)) continue;
        
        if (this.areSimilar(contexts[i], contexts[j])) {
          similar.push(contexts[j]);
          processed.add(contexts[j].id);
        }
      }
      
      if (similar.length > 1) {
        similarGroups.push(similar);
      }
    }
    
    // Create issues for redundant groups
    for (const group of similarGroups) {
      if (group.length >= 2) {
        const severity = group.length >= 4 ? 'warning' : 'info';
        issues.push({
          severity,
          type: 'redundancy',
          description: `Found ${group.length} similar context items that could be consolidated`,
          affectedItems: group.map(c => c.id),
          suggestion: 'Consider merging similar contexts to reduce redundancy and improve clarity'
        });
      }
    }
    
    return issues;
  }

  /**
   * Check if two contexts are similar enough to be considered redundant
   */
  private areSimilar(c1: ContextItem, c2: ContextItem): boolean {
    // Same type is a good start
    if (c1.type !== c2.type) return false;
    
    // Check for similar content using simple text similarity
    const similarity = this.calculateTextSimilarity(c1.content, c2.content);
    if (similarity > 0.8) return true;
    
    // Check for overlapping files
    const c1Files = new Set(c1.metadata.files || []);
    const c2Files = new Set(c2.metadata.files || []);
    const intersection = new Set([...c1Files].filter(f => c2Files.has(f)));
    const union = new Set([...c1Files, ...c2Files]);
    
    if (union.size > 0 && intersection.size / union.size > 0.7) return true;
    
    // Check for similar keywords
    const c1Keywords = new Set((c1.metadata.keywords || []).map(k => k.toLowerCase()));
    const c2Keywords = new Set((c2.metadata.keywords || []).map(k => k.toLowerCase()));
    const keywordIntersection = new Set([...c1Keywords].filter(k => c2Keywords.has(k)));
    const keywordUnion = new Set([...c1Keywords, ...c2Keywords]);
    
    if (keywordUnion.size > 0 && keywordIntersection.size / keywordUnion.size > 0.6) return true;
    
    return false;
  }

  /**
   * Calculate simple text similarity using word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private areConflicting(c1: ContextItem, c2: ContextItem): boolean {
    // Simple heuristic: if they mention same files but have opposite keywords
    const c1Files = new Set(c1.metadata.files || []);
    const c2Files = new Set(c2.metadata.files || []);
    const overlap = [...c1Files].filter(f => c2Files.has(f));
    
    if (overlap.length === 0) return false;
    
    // Check for opposite keywords
    const opposites = [
      ['use', 'avoid'],
      ['should', 'should not'],
      ['enable', 'disable'],
      ['add', 'remove'],
    ];
    
    const c1Text = c1.content.toLowerCase();
    const c2Text = c2.content.toLowerCase();
    
    return opposites.some(([pos, neg]) => 
      (c1Text.includes(pos) && c2Text.includes(neg)) ||
      (c1Text.includes(neg) && c2Text.includes(pos))
    );
  }

  private calculateMetrics(contexts: ContextItem[], issues: HealthIssue[]) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate actual coverage
    const allProjectFiles = this.getAllProjectFiles();
    const filesWithContext = this.getFilesWithContext(contexts);
    const coverage = allProjectFiles.length > 0 ? 
      Math.round((filesWithContext.size / allProjectFiles.length) * 100) : 0;
    
    // Calculate average relevance (for now use a default, could be enhanced with actual scoring)
    const avgRelevance = 50; // TODO: Integrate with actual relevance scoring when available
    
    return {
      totalItems: contexts.length,
      freshItems: contexts.filter(c => c.timestamp > sevenDaysAgo).length,
      staleItems: issues.filter(i => i.type === 'staleness').length,
      conflicts: issues.filter(i => i.type === 'conflict').length,
      coverage,
      avgRelevance,
    };
  }

  private calculateHealthScore(metrics: any, issues: HealthIssue[]): number {
    let score = 100;
    
    // Deduct for issues
    score -= issues.filter(i => i.severity === 'critical').length * 15;
    score -= issues.filter(i => i.severity === 'warning').length * 5;
    
    // Deduct for staleness
    if (metrics.staleItems > 0) {
      score -= (metrics.staleItems / metrics.totalItems) * 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(issues: HealthIssue[], metrics: any): string[] {
    const recs: string[] = [];
    
    if (issues.some(i => i.type === 'staleness')) {
      recs.push('Review and update contexts older than 30 days');
    }
    
    if (issues.some(i => i.type === 'conflict')) {
      recs.push('Resolve conflicting decisions immediately');
    }
    
    if (metrics.totalItems < 10) {
      recs.push('Add more context to improve AI assistance quality');
    }
    
    return recs;
  }

  /**
   * Get all project files that should be considered for context coverage
   */
  private getAllProjectFiles(): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.go', '.rs', '.rb', '.php', '.swift', '.kt'];
    
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common directories that don't need context
            if (!['node_modules', 'dist', 'build', '.git', '.next', 'out', 'coverage', '__pycache__', 'vendor'].includes(entry.name)) {
              walk(fullPath);
            }
          } else {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(this.workspacePath);
    return files;
  }

  /**
   * Get set of files that have associated context
   */
  private getFilesWithContext(contexts: ContextItem[]): Set<string> {
    const filesWithContext = new Set<string>();
    
    for (const context of contexts) {
      if (context.metadata?.files) {
        for (const file of context.metadata.files) {
          filesWithContext.add(path.resolve(file));
        }
      }
      
      // Also check if context content mentions specific files
      const fileMatches = context.content.match(/[\w\/\-\.]+\.(ts|js|py|java|cs|cpp|c|h|go|rs|rb|php|swift|kt)(?:\b|$)/g);
      if (fileMatches) {
        for (const match of fileMatches) {
          const possiblePath = path.resolve(this.workspacePath, match);
          if (fs.existsSync(possiblePath)) {
            filesWithContext.add(possiblePath);
          }
        }
      }
    }
    
    return filesWithContext;
  }

  /**
   * Identify important files that should have context coverage
   */
  private identifyImportantFiles(allFiles: string[]): string[] {
    const important: string[] = [];
    
    for (const file of allFiles) {
      const basename = path.basename(file).toLowerCase();
      const relativePath = path.relative(this.workspacePath, file).toLowerCase();
      
      // Entry points and main files
      if (basename === 'index.ts' || basename === 'index.js' || 
          basename === 'main.ts' || basename === 'main.js' ||
          basename === 'app.ts' || basename === 'app.js' ||
          basename === 'server.ts' || basename === 'server.js' ||
          basename === '__init__.py' || basename === 'main.py') {
        important.push(file);
      }
      
      // Config files
      if (basename.includes('config') || basename.includes('settings')) {
        important.push(file);
      }
      
      // API routes and controllers
      if (relativePath.includes('/api/') || relativePath.includes('/routes/') || 
          relativePath.includes('/controllers/') || relativePath.includes('/handlers/')) {
        important.push(file);
      }
      
      // Models and schemas
      if (relativePath.includes('/models/') || relativePath.includes('/schemas/') || 
          relativePath.includes('/entities/')) {
        important.push(file);
      }
    }
    
    return important;
  }

  /**
   * Find directories with low context coverage
   */
  private findDirectoryGaps(allFiles: string[], filesWithContext: Set<string>): Array<{
    directory: string;
    coverage: number;
    uncoveredFiles: string[];
  }> {
    const directoryStats = new Map<string, { total: number; covered: number; files: string[] }>();
    
    // Group files by directory
    for (const file of allFiles) {
      const dir = path.dirname(path.relative(this.workspacePath, file));
      if (!directoryStats.has(dir)) {
        directoryStats.set(dir, { total: 0, covered: 0, files: [] });
      }
      
      const stats = directoryStats.get(dir)!;
      stats.total++;
      stats.files.push(file);
      
      if (filesWithContext.has(file)) {
        stats.covered++;
      }
    }
    
    const gaps: Array<{ directory: string; coverage: number; uncoveredFiles: string[] }> = [];
    
    for (const [dir, stats] of directoryStats) {
      if (stats.total >= 3) { // Only consider directories with at least 3 files
        const coverage = Math.round((stats.covered / stats.total) * 100);
        if (coverage < 50) { // Less than 50% coverage
          const uncoveredFiles = stats.files.filter(file => !filesWithContext.has(file));
          gaps.push({
            directory: dir,
            coverage,
            uncoveredFiles
          });
        }
      }
    }
    
    return gaps;
  }
}

export function createContextHealthMonitor(workspacePath?: string): ContextHealthMonitor {
  return new ContextHealthMonitor(workspacePath);
}