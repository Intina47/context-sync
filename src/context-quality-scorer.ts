/**
 * Lightweight Context Quality Scorer
 * Scores extracted context 0.0-1.0 based on value
 * Simple point system, no ML, <1ms per score
 */

import { ExtractedContext } from './context-extractor.js';

export interface QualityScore {
  score: number; // 0.0-1.0
  reasons: string[];
  shouldSave: boolean; // true if score >= threshold
}

/**
 * Quality scoring for extracted context
 * Fast heuristic-based scoring
 */
export class ContextQualityScorer {
  
  // Thresholds
  private static readonly AUTO_SAVE_THRESHOLD = 0.7;  // Auto-save if >= 0.7
  private static readonly SUGGEST_THRESHOLD = 0.4;    // Suggest if >= 0.4
  
  /**
   * Score extracted context
   * @param context Extracted context to score
   * @returns Quality score with reasons
   */
  score(context: ExtractedContext): QualityScore {
    const reasons: string[] = [];
    let score = context.confidence; // Start with pattern confidence
    
    // Type-specific scoring
    switch (context.type) {
      case 'decision':
        score += this.scoreDecision(context, reasons);
        break;
      case 'problem-solution':
        score += this.scoreProblemSolution(context, reasons);
        break;
      case 'learning':
        score += this.scoreLearning(context, reasons);
        break;
      case 'comparison':
        score += this.scoreComparison(context, reasons);
        break;
      case 'anti-pattern':
        score += this.scoreAntiPattern(context, reasons);
        break;
    }
    
    // Cap at 1.0
    score = Math.min(score, 1.0);
    
    return {
      score,
      reasons,
      shouldSave: score >= ContextQualityScorer.AUTO_SAVE_THRESHOLD
    };
  }

  /**
   * Score decision quality
   * High value if: has reasoning, has alternatives, specific
   */
  private scoreDecision(decision: any, reasons: string[]): number {
    let bonus = 0;
    
    // Has reasoning? (+0.15)
    if (decision.reasoning && decision.reasoning.length > 10) {
      bonus += 0.15;
      reasons.push('Has reasoning');
    }
    
    // Has alternatives? (+0.10)
    if (decision.alternatives && decision.alternatives.length > 0) {
      bonus += 0.10;
      reasons.push(`Considered ${decision.alternatives.length} alternatives`);
    }
    
    // Specific enough? (+0.05)
    if (decision.description.length > 20) {
      bonus += 0.05;
      reasons.push('Specific description');
    }
    
    // Contains technical terms? (+0.05)
    if (this.containsTechnicalTerms(decision.description)) {
      bonus += 0.05;
      reasons.push('Technical content');
    }
    
    return bonus;
  }

  /**
   * Score problem-solution quality
   * High value if: clear problem, actionable solution, technical
   */
  private scoreProblemSolution(problem: any, reasons: string[]): number {
    let bonus = 0;
    
    // Problem is specific? (+0.10)
    if (problem.problem.length > 15) {
      bonus += 0.10;
      reasons.push('Specific problem');
    }
    
    // Solution is actionable? (+0.15)
    if (problem.solution.length > 20) {
      bonus += 0.15;
      reasons.push('Detailed solution');
    }
    
    // Contains technical terms? (+0.10)
    if (this.containsTechnicalTerms(problem.solution)) {
      bonus += 0.10;
      reasons.push('Technical solution');
    }
    
    return bonus;
  }

  /**
   * Score learning quality
   * High value if: insightful, specific, technical
   */
  private scoreLearning(learning: any, reasons: string[]): number {
    let bonus = 0;
    
    // Insight is substantial? (+0.15)
    if (learning.insight.length > 30) {
      bonus += 0.15;
      reasons.push('Substantial insight');
    }
    
    // Contains technical depth? (+0.10)
    if (this.containsTechnicalTerms(learning.insight)) {
      bonus += 0.10;
      reasons.push('Technical insight');
    }
    
    // Has strong keywords? (+0.05)
    if (/\b(always|never|important|critical|key|must|avoid)\b/i.test(learning.insight)) {
      bonus += 0.05;
      reasons.push('Strong takeaway');
    }
    
    return bonus;
  }

  /**
   * Score comparison quality
   * High value if: has winner, has reasoning, trade-offs discussed
   */
  private scoreComparison(comparison: any, reasons: string[]): number {
    let bonus = 0;
    
    // Has winner? (+0.10)
    if (comparison.winner) {
      bonus += 0.10;
      reasons.push('Clear choice made');
    }
    
    // Has reasoning? (+0.15)
    if (comparison.reasoning && comparison.reasoning.length > 10) {
      bonus += 0.15;
      reasons.push('Has reasoning');
    }
    
    // Technical comparison? (+0.05)
    if (this.containsTechnicalTerms(comparison.optionA + comparison.optionB)) {
      bonus += 0.05;
      reasons.push('Technical comparison');
    }
    
    return bonus;
  }

  /**
   * Score anti-pattern quality
   * High value if: has explanation, specific, actionable
   */
  private scoreAntiPattern(antiPattern: any, reasons: string[]): number {
    let bonus = 0;
    
    // Has explanation? (+0.15)
    if (antiPattern.why && antiPattern.why.length > 15) {
      bonus += 0.15;
      reasons.push('Has explanation');
    }
    
    // Specific warning? (+0.10)
    if (antiPattern.description.length > 20) {
      bonus += 0.10;
      reasons.push('Specific warning');
    }
    
    return bonus;
  }

  /**
   * Check if text contains technical terms
   * Lightweight keyword matching
   */
  private containsTechnicalTerms(text: string): boolean {
    const techPattern = /\b(api|function|class|method|async|await|promise|callback|array|object|database|query|sql|cache|index|performance|optimize|algorithm|memory|cpu|latency|typescript|javascript|python|react|node|component|state|props|hook|reducer|middleware|schema|model|controller|service|repository|entity)\b/i;
    return techPattern.test(text);
  }

  /**
   * Batch score multiple contexts
   * Returns only those worth saving (>= suggest threshold)
   */
  scoreAll(contexts: ExtractedContext[]): Array<{ context: ExtractedContext; score: QualityScore }> {
    return contexts
      .map(context => ({
        context,
        score: this.score(context)
      }))
      .filter(item => item.score.score >= ContextQualityScorer.SUGGEST_THRESHOLD)
      .sort((a, b) => b.score.score - a.score.score); // Highest first
  }

  /**
   * Get auto-save candidates (>= 0.7)
   */
  getAutoSaveCandidates(contexts: ExtractedContext[]): Array<{ context: ExtractedContext; score: QualityScore }> {
    return this.scoreAll(contexts)
      .filter(item => item.score.shouldSave);
  }

  /**
   * Get suggest candidates (0.4-0.7)
   */
  getSuggestCandidates(contexts: ExtractedContext[]): Array<{ context: ExtractedContext; score: QualityScore }> {
    return this.scoreAll(contexts)
      .filter(item => !item.score.shouldSave && item.score.score >= ContextQualityScorer.SUGGEST_THRESHOLD);
  }
}
