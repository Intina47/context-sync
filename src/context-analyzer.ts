import type { ProjectContext } from './types.js';

export interface ContextSuggestion {
  type: 'decision' | 'todo' | 'conversation';
  priority: 'high' | 'medium' | 'low';
  content: string;
  reasoning: string;
  suggestedAction: string;
}

export interface ConversationAnalysis {
  decisions: ContextSuggestion[];
  todos: ContextSuggestion[];
  insights: ContextSuggestion[];
  summary: string;
}

export class ContextAnalyzer {
  // Keywords that indicate technical decisions
  private static readonly DECISION_TRIGGERS = [
    'we should use', 'let\'s go with', 'i recommend', 'decided to', 'we\'ll use',
    'best approach is', 'we\'ll implement', 'chosen', 'selected', 'opted for',
    'architecture', 'framework', 'library', 'database', 'deployment',
    'pattern', 'design', 'structure', 'approach', 'strategy', 'solution'
  ];

  // Keywords that indicate action items/todos
  private static readonly TODO_TRIGGERS = [
    'need to', 'should implement', 'todo', 'action item', 'next step',
    'follow up', 'remember to', 'don\'t forget', 'make sure to',
    'we need', 'must', 'have to', 'should add', 'should fix',
    'refactor', 'optimize', 'improve', 'update', 'modify'
  ];

  // Keywords that indicate important insights
  private static readonly INSIGHT_TRIGGERS = [
    'discovered', 'found out', 'realized', 'learned', 'breakthrough',
    'key insight', 'important', 'critical', 'crucial', 'significant',
    'problem solved', 'solution', 'workaround', 'fix', 'resolution'
  ];

  // Technical context keywords that increase importance
  private static readonly TECHNICAL_KEYWORDS = [
    'api', 'database', 'security', 'performance', 'scalability',
    'authentication', 'authorization', 'caching', 'testing',
    'deployment', 'configuration', 'architecture', 'design pattern',
    'algorithm', 'optimization', 'integration', 'migration'
  ];

  /**
   * Analyze conversation content for context that should be saved
   */
  static analyzeConversation(conversationText: string): ConversationAnalysis {
    const sentences = this.splitIntoSentences(conversationText);
    const decisions: ContextSuggestion[] = [];
    const todos: ContextSuggestion[] = [];
    const insights: ContextSuggestion[] = [];

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      // Check for decisions
      const decisionMatch = this.DECISION_TRIGGERS.find(trigger => 
        lowerSentence.includes(trigger.toLowerCase())
      );
      
      if (decisionMatch) {
        const priority = this.calculatePriority(sentence);
        decisions.push({
          type: 'decision',
          priority,
          content: sentence.trim(),
          reasoning: `Contains decision trigger: "${decisionMatch}"`,
          suggestedAction: `save_decision with type based on content context`
        });
      }

      // Check for todos
      const todoMatch = this.TODO_TRIGGERS.find(trigger => 
        lowerSentence.includes(trigger.toLowerCase())
      );
      
      if (todoMatch) {
        const priority = this.calculatePriority(sentence);
        todos.push({
          type: 'todo',
          priority,
          content: sentence.trim(),
          reasoning: `Contains todo trigger: "${todoMatch}"`,
          suggestedAction: `todo_create with extracted task`
        });
      }

      // Check for insights
      const insightMatch = this.INSIGHT_TRIGGERS.find(trigger => 
        lowerSentence.includes(trigger.toLowerCase())
      );
      
      if (insightMatch) {
        const priority = this.calculatePriority(sentence);
        insights.push({
          type: 'conversation',
          priority,
          content: sentence.trim(),
          reasoning: `Contains insight trigger: "${insightMatch}"`,
          suggestedAction: `save_conversation as key insight`
        });
      }
    }

    // Create summary
    const totalSuggestions = decisions.length + todos.length + insights.length;
    const summary = totalSuggestions > 0 
      ? `Found ${totalSuggestions} context items to save: ${decisions.length} decisions, ${todos.length} todos, ${insights.length} insights`
      : 'No significant context detected for saving';

    return {
      decisions,
      todos,
      insights,
      summary
    };
  }

  /**
   * Calculate priority based on technical keywords and sentence structure
   */
  private static calculatePriority(sentence: string): 'high' | 'medium' | 'low' {
    const lowerSentence = sentence.toLowerCase();
    
    // High priority indicators
    const hasMultipleTechnicalKeywords = this.TECHNICAL_KEYWORDS
      .filter(keyword => lowerSentence.includes(keyword.toLowerCase())).length >= 2;
    
    const hasHighPriorityWords = ['critical', 'important', 'must', 'crucial', 'essential']
      .some(word => lowerSentence.includes(word));
    
    if (hasMultipleTechnicalKeywords || hasHighPriorityWords) {
      return 'high';
    }

    // Medium priority indicators
    const hasTechnicalKeywords = this.TECHNICAL_KEYWORDS
      .some(keyword => lowerSentence.includes(keyword.toLowerCase()));
    
    const hasMediumPriorityWords = ['should', 'recommend', 'suggest', 'consider']
      .some(word => lowerSentence.includes(word));
    
    if (hasTechnicalKeywords || hasMediumPriorityWords) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Split text into meaningful sentences
   */
  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be enhanced with NLP
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short fragments
  }

  /**
   * Extract specific decision information from text
   */
  static extractDecision(text: string): { type: string; description: string; reasoning?: string } | null {
    const lowerText = text.toLowerCase();
    
    // Determine decision type based on keywords
    let type = 'other';
    if (lowerText.includes('architecture') || lowerText.includes('design')) type = 'architecture';
    else if (lowerText.includes('library') || lowerText.includes('framework') || lowerText.includes('package')) type = 'library';
    else if (lowerText.includes('pattern') || lowerText.includes('approach') || lowerText.includes('method')) type = 'pattern';
    else if (lowerText.includes('config') || lowerText.includes('setting') || lowerText.includes('environment')) type = 'configuration';

    // Extract reasoning if present
    const reasoningKeywords = ['because', 'since', 'due to', 'as', 'reason', 'why'];
    let reasoning: string | undefined;
    
    for (const keyword of reasoningKeywords) {
      const keywordIndex = lowerText.indexOf(keyword);
      if (keywordIndex !== -1) {
        reasoning = text.substring(keywordIndex).trim();
        break;
      }
    }

    return {
      type,
      description: text.trim(),
      reasoning
    };
  }

  /**
   * Extract todo information from text
   */
  static extractTodo(text: string): { title: string; description: string; priority: string } | null {
    const lowerText = text.toLowerCase();
    
    // Determine priority
    let priority = 'medium';
    if (lowerText.includes('urgent') || lowerText.includes('critical') || lowerText.includes('asap')) priority = 'high';
    else if (lowerText.includes('later') || lowerText.includes('eventually') || lowerText.includes('nice to have')) priority = 'low';

    // Extract title (first meaningful part)
    const title = text.split(/[.!?]/)[0].trim().substring(0, 100);
    
    return {
      title,
      description: text.trim(),
      priority
    };
  }
}