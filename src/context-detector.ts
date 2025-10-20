// Automatic context detection from conversations

export interface DetectedContext {
  type: 'tech' | 'decision' | 'architecture' | 'library';
  content: string;
  confidence: number;
  reasoning?: string;
}

export class ContextDetector {
  /**
   * Detect context from a message
   */
  detect(message: string): DetectedContext[] {
    const detected: DetectedContext[] = [];

    // Detect technologies
    detected.push(...this.detectTechnologies(message));

    // Detect decisions
    detected.push(...this.detectDecisions(message));

    // Detect architecture patterns
    detected.push(...this.detectArchitecture(message));

    // Filter by confidence threshold
    return detected.filter(d => d.confidence >= 0.7);
  }

  private detectTechnologies(message: string): DetectedContext[] {
    const detected: DetectedContext[] = [];

    // Technology mention patterns
    const techPatterns = [
      // "using X for Y"
      {
        regex: /(?:using|use|with)\s+([A-Z]\w+(?:\s+[A-Z]\w+)?)\s+for\s+(\w+)/gi,
        confidence: 0.9
      },
      // "add/integrate X"
      {
        regex: /(?:add|integrate|integrating|install|setup|set up)\s+([A-Z]\w+(?:\s+\d+)?)/gi,
        confidence: 0.85
      },
      // "X database/framework/library"
      {
        regex: /([A-Z]\w+(?:\s+\d+)?)\s+(?:database|framework|library|ORM|auth)/gi,
        confidence: 0.8
      }
    ];

    for (const pattern of techPatterns) {
      const matches = Array.from(message.matchAll(pattern.regex));
      for (const match of matches) {
        const tech = match[1].trim();
        
        // Filter out common words
        if (this.isValidTech(tech)) {
          detected.push({
            type: 'tech',
            content: tech,
            confidence: pattern.confidence,
            reasoning: `Detected from pattern: ${match[0]}`
          });
        }
      }
    }

    return detected;
  }

  private detectDecisions(message: string): DetectedContext[] {
    const detected: DetectedContext[] = [];

    // Decision patterns
    const decisionPatterns = [
      // "decided to..."
      {
        regex: /(?:decided|decide|decision)\s+(?:to\s+)?(.+?)(?:\s+because\s+(.+?))?(?:\.|$)/gi,
        confidence: 0.95
      },
      // "going to use..."
      {
        regex: /(?:going to|gonna|will)\s+use\s+(.+?)(?:\s+for\s+(.+?))?(?:\s+because\s+(.+?))?(?:\.|$)/gi,
        confidence: 0.9
      },
      // "chose X over Y"
      {
        regex: /(?:chose|choose|chosen)\s+(.+?)\s+over\s+(.+?)(?:\s+because\s+(.+?))?(?:\.|$)/gi,
        confidence: 0.95
      }
    ];

    for (const pattern of decisionPatterns) {
      const matches = Array.from(message.matchAll(pattern.regex));
      for (const match of matches) {
        const decision = match[1].trim();
        const reasoning = match[2] || match[3];

        detected.push({
          type: 'decision',
          content: decision,
          confidence: pattern.confidence,
          reasoning: reasoning ? reasoning.trim() : undefined
        });
      }
    }

    return detected;
  }

  private detectArchitecture(message: string): DetectedContext[] {
    const detected: DetectedContext[] = [];

    // Architecture patterns
    const archPatterns = [
      // "Next.js 14 with TypeScript"
      {
        regex: /(Next\.js\s+\d+|React|Vue|Angular|Svelte)\s+with\s+(.+?)(?:\s+and\s+(.+?))?(?:\.|$)/gi,
        confidence: 0.9
      },
      // "using [stack]"
      {
        regex: /using\s+([A-Z]\w+(?:\s+\d+)?)\s*\+\s*([A-Z]\w+)/gi,
        confidence: 0.85
      }
    ];

    for (const pattern of archPatterns) {
      const matches = Array.from(message.matchAll(pattern.regex));
      for (const match of matches) {
        detected.push({
          type: 'architecture',
          content: match[0].trim(),
          confidence: pattern.confidence
        });
      }
    }

    return detected;
  }

  /**
   * Check if a string is a valid technology name
   */
  private isValidTech(tech: string): boolean {
    // Filter out common words that aren't tech
    const commonWords = [
      'the', 'and', 'for', 'with', 'this', 'that', 
      'have', 'from', 'they', 'will', 'would',
      'there', 'their', 'what', 'when', 'where'
    ];

    const lower = tech.toLowerCase();
    
    // Must start with capital or be known tech
    if (!tech[0] || tech[0] !== tech[0].toUpperCase()) {
      return false;
    }

    // Not a common word
    if (commonWords.includes(lower)) {
      return false;
    }

    // Has reasonable length
    if (tech.length < 2 || tech.length > 30) {
      return false;
    }

    return true;
  }

  /**
   * Merge duplicate detections
   */
  mergeDuplicates(detections: DetectedContext[]): DetectedContext[] {
    const seen = new Map<string, DetectedContext>();

    for (const detection of detections) {
      const key = `${detection.type}:${detection.content.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, detection);
      } else {
        // Keep the one with higher confidence
        const existing = seen.get(key)!;
        if (detection.confidence > existing.confidence) {
          seen.set(key, detection);
        }
      }
    }

    return Array.from(seen.values());
  }
}