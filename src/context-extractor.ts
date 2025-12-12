/**
 * Lightweight Context Extractor
 * Detects valuable patterns in conversations using regex + heuristics
 * Target: <10ms per message, zero dependencies
 */

export interface ExtractedDecision {
  type: 'decision';
  description: string;
  reasoning?: string;
  alternatives?: string[];
  confidence: number; // 0.0-1.0
}

export interface ExtractedProblem {
  type: 'problem-solution';
  problem: string;
  solution: string;
  confidence: number;
}

export interface ExtractedLearning {
  type: 'learning';
  insight: string;
  context?: string;
  confidence: number;
}

export interface ExtractedComparison {
  type: 'comparison';
  optionA: string;
  optionB: string;
  winner?: string;
  reasoning?: string;
  confidence: number;
}

export interface ExtractedAntiPattern {
  type: 'anti-pattern';
  description: string;
  why: string;
  confidence: number;
}

export type ExtractedContext = 
  | ExtractedDecision 
  | ExtractedProblem 
  | ExtractedLearning 
  | ExtractedComparison
  | ExtractedAntiPattern;

/**
 * Lightweight pattern detection engine
 * No NLP, no ML - just fast regex and heuristics
 */
export class ContextExtractor {
  
  // Decision indicators
  private static DECISION_PATTERNS = [
    /(?:decided|chose|going with|settled on|picked|selected)\s+(.+?)(?:\sbecause\s+(.+?))?[.!]?$/i,
    /(?:should|will|going to)\s+(?:use|implement|go with|choose)\s+(.+?)(?:\sbecause\s+(.+?))?[.!]?$/i,
    /(?:use|using)\s+(.+?)\s+(?:instead of|rather than|over)\s+(.+?)(?:\sbecause\s+(.+?))?[.!]?$/i,
  ];

  // Problem-solution indicators
  private static PROBLEM_PATTERNS = [
    /(?:error|bug|issue|problem):\s*(.+?)$/i,
    /(?:failed|broken|not working|doesn't work):\s*(.+?)$/i,
  ];

  private static SOLUTION_PATTERNS = [
    /(?:fixed|solved|resolved)\s+(?:by|with|using)\s+(.+?)$/i,
    /(?:solution|fix):\s*(.+?)$/i,
  ];

  // Learning/insight indicators
  private static LEARNING_PATTERNS = [
    /(?:learned|discovered|realized|found out)\s+(?:that\s+)?(.+?)$/i,
    /(?:insight|key takeaway|important):\s*(.+?)$/i,
    /(?:turns out|it appears|apparently)\s+(.+?)$/i,
  ];

  // Comparison indicators
  private static COMPARISON_PATTERNS = [
    /(.+?)\s+vs\.?\s+(.+?)(?:\s*[:-]\s*(.+?))?$/i,
    /(?:comparing|compare)\s+(.+?)\s+(?:and|vs|versus)\s+(.+?)$/i,
    /(?:better to use|prefer)\s+(.+?)\s+over\s+(.+?)(?:\sbecause\s+(.+?))?$/i,
  ];

  // Anti-pattern indicators
  private static ANTIPATTERN_PATTERNS = [
    /(?:don't|avoid|never)\s+(.+?)(?:\sbecause\s+(.+?))?$/i,
    /(?:mistake|wrong|bad practice):\s*(.+?)$/i,
    /(.+?)\s+(?:is|was)\s+(?:a bad idea|wrong approach|mistake)(?:\sbecause\s+(.+?))?$/i,
  ];

  /**
   * Analyze a conversation segment and extract patterns
   * @param messages Array of messages (user + AI) 
   * @returns Array of extracted contexts with confidence scores
   */
  extractFromConversation(messages: string[]): ExtractedContext[] {
    const results: ExtractedContext[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;
      
      // Try decision detection
      const decision = this.detectDecision(message, nextMessage);
      if (decision) results.push(decision);
      
      // Try problem-solution detection (needs context)
      if (nextMessage) {
        const problem = this.detectProblemSolution(message, nextMessage);
        if (problem) results.push(problem);
      }
      
      // Try learning detection
      const learning = this.detectLearning(message);
      if (learning) results.push(learning);
      
      // Try comparison detection
      const comparison = this.detectComparison(message, nextMessage);
      if (comparison) results.push(comparison);
      
      // Try anti-pattern detection
      const antiPattern = this.detectAntiPattern(message);
      if (antiPattern) results.push(antiPattern);
    }
    
    return results;
  }

  /**
   * Detect decision patterns
   * Looks for: "decided to X", "using Y because Z", "chose A over B"
   */
  private detectDecision(message: string, nextMessage: string | null): ExtractedDecision | null {
    // Quick filters - must contain decision keywords
    const hasDecisionWord = /\b(decide|chose|use|using|implement|go with|pick|select|settle)\b/i.test(message);
    if (!hasDecisionWord) return null;
    
    for (const pattern of ContextExtractor.DECISION_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const description = match[1]?.trim();
        const reasoning = match[2]?.trim() || match[3]?.trim();
        
        if (!description || description.length < 5) continue;
        
        // Extract alternatives from context
        const alternatives = this.extractAlternatives(message);
        
        // Calculate confidence
        let confidence = 0.5;
        if (reasoning) confidence += 0.2;
        if (alternatives.length > 0) confidence += 0.1;
        if (this.hasTechnicalTerms(message)) confidence += 0.1;
        if (nextMessage && /\b(because|reason|since)\b/i.test(nextMessage)) confidence += 0.1;
        
        return {
          type: 'decision',
          description,
          reasoning: reasoning || undefined,
          alternatives: alternatives.length > 0 ? alternatives : undefined,
          confidence: Math.min(confidence, 1.0)
        };
      }
    }
    
    return null;
  }

  /**
   * Detect problem-solution patterns
   * Looks for: "Error: X" followed by "Fixed by Y"
   */
  private detectProblemSolution(problemMsg: string, solutionMsg: string): ExtractedProblem | null {
    let problemText: string | null = null;
    
    // Detect problem
    for (const pattern of ContextExtractor.PROBLEM_PATTERNS) {
      const match = problemMsg.match(pattern);
      if (match) {
        problemText = match[1]?.trim();
        break;
      }
    }
    
    if (!problemText) return null;
    
    // Detect solution in next message
    for (const pattern of ContextExtractor.SOLUTION_PATTERNS) {
      const match = solutionMsg.match(pattern);
      if (match) {
        const solutionText = match[1]?.trim();
        
        if (!solutionText || solutionText.length < 5) continue;
        
        // Calculate confidence
        let confidence = 0.6;
        if (this.hasTechnicalTerms(solutionText)) confidence += 0.2;
        if (this.hasCodeSnippet(solutionMsg)) confidence += 0.1;
        
        return {
          type: 'problem-solution',
          problem: problemText,
          solution: solutionText,
          confidence: Math.min(confidence, 1.0)
        };
      }
    }
    
    return null;
  }

  /**
   * Detect learning/insight patterns
   * Looks for: "learned that X", "discovered Y", "turns out Z"
   */
  private detectLearning(message: string): ExtractedLearning | null {
    for (const pattern of ContextExtractor.LEARNING_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const insight = match[1]?.trim();
        
        if (!insight || insight.length < 10) continue;
        
        // Calculate confidence
        let confidence = 0.5;
        if (this.hasTechnicalTerms(message)) confidence += 0.2;
        if (insight.length > 50) confidence += 0.1;
        if (/\b(always|never|important|critical|key)\b/i.test(message)) confidence += 0.1;
        
        return {
          type: 'learning',
          insight,
          context: message.substring(0, 100),
          confidence: Math.min(confidence, 1.0)
        };
      }
    }
    
    return null;
  }

  /**
   * Detect comparison patterns
   * Looks for: "X vs Y", "prefer A over B because C"
   */
  private detectComparison(message: string, nextMessage: string | null): ExtractedComparison | null {
    for (const pattern of ContextExtractor.COMPARISON_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const optionA = match[1]?.trim();
        const optionB = match[2]?.trim();
        const reasoning = match[3]?.trim();
        
        if (!optionA || !optionB) continue;
        if (optionA.length < 2 || optionB.length < 2) continue;
        
        // Detect winner
        let winner: string | undefined;
        if (/\b(better|prefer|chose|use)\b/i.test(message)) {
          winner = optionA;
        }
        
        // Calculate confidence
        let confidence = 0.5;
        if (reasoning) confidence += 0.2;
        if (winner) confidence += 0.1;
        if (this.hasTechnicalTerms(message)) confidence += 0.1;
        
        return {
          type: 'comparison',
          optionA,
          optionB,
          winner,
          reasoning: reasoning || undefined,
          confidence: Math.min(confidence, 1.0)
        };
      }
    }
    
    return null;
  }

  /**
   * Detect anti-pattern warnings
   * Looks for: "don't do X", "avoid Y", "X is a mistake"
   */
  private detectAntiPattern(message: string): ExtractedAntiPattern | null {
    for (const pattern of ContextExtractor.ANTIPATTERN_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const description = match[1]?.trim();
        const why = match[2]?.trim();
        
        if (!description || description.length < 5) continue;
        
        // Calculate confidence
        let confidence = 0.6;
        if (why) confidence += 0.2;
        if (this.hasTechnicalTerms(message)) confidence += 0.1;
        
        return {
          type: 'anti-pattern',
          description,
          why: why || 'Identified as bad practice',
          confidence: Math.min(confidence, 1.0)
        };
      }
    }
    
    return null;
  }

  // ========== HELPER METHODS (LIGHTWEIGHT) ==========

  /**
   * Extract alternative options from text
   * Looks for: "X or Y", "X vs Y", "X and Y"
   */
  private extractAlternatives(text: string): string[] {
    const alternatives: string[] = [];
    
    // Pattern: "X or Y"
    const orMatch = text.match(/(\w+(?:\s+\w+)?)\s+or\s+(\w+(?:\s+\w+)?)/i);
    if (orMatch) {
      alternatives.push(orMatch[1].trim(), orMatch[2].trim());
    }
    
    // Pattern: "instead of X"
    const insteadMatch = text.match(/instead of\s+(\w+(?:\s+\w+)?)/i);
    if (insteadMatch) {
      alternatives.push(insteadMatch[1].trim());
    }
    
    return alternatives;
  }

  /**
   * Check if text contains technical terms
   * Simple heuristic: looks for common tech keywords
   */
  private hasTechnicalTerms(text: string): boolean {
    const techKeywords = [
      'api', 'function', 'class', 'method', 'async', 'promise', 'array', 'object',
      'database', 'query', 'cache', 'performance', 'optimize', 'algorithm',
      'typescript', 'javascript', 'python', 'sql', 'react', 'node',
      'memory', 'cpu', 'latency', 'throughput', 'index', 'schema'
    ];
    
    const lowerText = text.toLowerCase();
    return techKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Check if text contains code snippet indicators
   */
  private hasCodeSnippet(text: string): boolean {
    return /```|`\w+`|\{\s*\}|\[\s*\]|=>|function\s*\(|const\s+\w+\s*=/.test(text);
  }
}
