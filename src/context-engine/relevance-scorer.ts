/**
 * Relevance Scorer - Intelligent context relevance scoring
 * 
 * Solves: Users have 100+ line context files but only need 10 lines
 * Scores every piece of context for relevance to current task
 */

import { EventEmitter } from 'events';

interface OpenAIConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

interface EmbeddingCache {
  [key: string]: number[];
}

export interface ContextItem {
  id: string;
  type: 'decision' | 'conversation' | 'code' | 'file' | 'documentation';
  content: string;
  timestamp: Date;
  metadata: {
    project?: string;
    files?: string[];
    functions?: string[];
    keywords?: string[];
    author?: string;
  };
  tokens: number;
}

export interface RelevanceScore {
  contextId: string;
  score: number; // 0-100
  factors: {
    recency: number;       // How recent?
    semantic: number;      // Semantic similarity
    frequency: number;     // How often referenced?
    structural: number;    // Related to files being worked on?
    temporal: number;      // Time-based relevance
    causal: number;        // Led to current state?
  };
  reasoning: string;
}

export interface ScoringContext {
  currentFiles: string[];
  currentFunction?: string;
  recentConversation: string[];
  activeKeywords: string[];
  timeWindow: Date;
  taskDescription?: string;
}

export class RelevanceScorer extends EventEmitter {
  private openaiConfig: OpenAIConfig;
  private embeddingCache: EmbeddingCache = {};
  private useEmbeddings: boolean;

  constructor(config: OpenAIConfig = {}) {
    super();
    this.openaiConfig = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      apiUrl: config.apiUrl || 'https://api.openai.com/v1/embeddings',
      model: config.model || 'text-embedding-ada-002',
      ...config
    };
    this.useEmbeddings = !!this.openaiConfig.apiKey;
    
    if (!this.useEmbeddings) {
      this.emit('warning', 'OpenAI API key not provided, falling back to keyword matching');
    }
  }
  
  async scoreContext(
    item: ContextItem, 
    context: ScoringContext
  ): Promise<RelevanceScore> {
    
    const factors = {
      recency: this.scoreRecency(item.timestamp, context.timeWindow),
      semantic: await this.scoreSemantic(item, context),
      frequency: await this.scoreFrequency(item.id),
      structural: this.scoreStructural(item, context),
      temporal: this.scoreTemporal(item, context),
      causal: await this.scoreCausal(item, context),
    };

    // Weighted average - tunable weights
    const weights = {
      recency: 0.15,
      semantic: 0.35, // Most important
      frequency: 0.10,
      structural: 0.20,
      temporal: 0.10,
      causal: 0.10,
    };

    const score = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof typeof weights]);
    }, 0);

    return {
      contextId: item.id,
      score: Math.round(score),
      factors,
      reasoning: this.generateReasoning(factors, score),
    };
  }

  async scoreAndRank(
    items: ContextItem[],
    context: ScoringContext,
    limit?: number
  ): Promise<Array<ContextItem & { relevanceScore: RelevanceScore }>> {
    
    const scored = await Promise.all(
      items.map(async (item) => ({
        ...item,
        relevanceScore: await this.scoreContext(item, context),
      }))
    );

    scored.sort((a, b) => b.relevanceScore.score - a.relevanceScore.score);
    return limit ? scored.slice(0, limit) : scored;
  }

  private scoreRecency(itemDate: Date, referenceDate: Date): number {
    const ageInDays = (referenceDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (ageInDays <= 1) return 100;
    if (ageInDays <= 7) return 90;
    if (ageInDays <= 30) return 70;
    if (ageInDays <= 90) return 40;
    return 20;
  }

  private async scoreSemantic(item: ContextItem, context: ScoringContext): Promise<number> {
    if (this.useEmbeddings) {
      try {
        return await this.scoreSemanticWithEmbeddings(item, context);
      } catch (error) {
        this.emit('embedding-error', error);
        // Fall back to keyword matching
      }
    }
    
    return this.scoreSemanticWithKeywords(item, context);
  }

  /**
   * Advanced semantic scoring using OpenAI embeddings
   */
  private async scoreSemanticWithEmbeddings(item: ContextItem, context: ScoringContext): Promise<number> {
    const itemText = this.extractText(item);
    const contextText = [
      ...context.currentFiles,
      ...(context.recentConversation || []),
      ...(context.activeKeywords || []),
      context.taskDescription || '',
    ].join(' ');

    // Get embeddings for both texts
    const [itemEmbedding, contextEmbedding] = await Promise.all([
      this.getEmbedding(itemText),
      this.getEmbedding(contextText)
    ]);

    // Calculate cosine similarity
    const similarity = this.calculateCosineSimilarity(itemEmbedding, contextEmbedding);
    
    // Convert similarity (-1 to 1) to score (0 to 100)
    const score = Math.max(0, (similarity + 1) / 2 * 100);
    
    this.emit('semantic-score', { itemId: item.id, similarity, score });
    
    return score;
  }

  /**
   * Fallback semantic scoring using keyword matching
   */
  private scoreSemanticWithKeywords(item: ContextItem, context: ScoringContext): number {
    const itemText = this.extractText(item).toLowerCase();
    const contextText = [
      ...context.currentFiles,
      ...(context.recentConversation || []),
      ...(context.activeKeywords || []),
      context.taskDescription || '',
    ].join(' ').toLowerCase();

    const itemWords = new Set(itemText.split(/\s+/).filter(w => w.length > 3));
    const contextWords = new Set(contextText.split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...itemWords].filter(x => contextWords.has(x)));
    const union = new Set([...itemWords, ...contextWords]);
    
    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }

  /**
   * Get embedding from OpenAI API with caching
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // Use a hash of the text as cache key
    const cacheKey = this.hashString(text);
    
    if (this.embeddingCache[cacheKey]) {
      return this.embeddingCache[cacheKey];
    }

    const response = await fetch(this.openaiConfig.apiUrl!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text.slice(0, 8000), // Limit text length
        model: this.openaiConfig.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    const embedding: number[] = data.data[0].embedding;
    
    // Cache the result
    this.embeddingCache[cacheKey] = embedding;
    
    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Simple string hash function for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Clear the embedding cache
   */
  public clearEmbeddingCache(): void {
    this.embeddingCache = {};
    this.emit('cache-cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: number } {
    const keys = Object.keys(this.embeddingCache);
    return {
      keys: keys.length,
      size: keys.length * (this.embeddingCache[keys[0]]?.length || 1536) * 8 // Approximate size in bytes
    };
  }

  /**
   * Check if embeddings are enabled
   */
  public isEmbeddingsEnabled(): boolean {
    return this.useEmbeddings;
  }

  private async scoreFrequency(contextId: string): Promise<number> {
    // TODO: Track in storage
    return 50;
  }

  private scoreStructural(item: ContextItem, context: ScoringContext): number {
    let score = 0;
    
    const itemFiles = new Set(item.metadata.files || []);
    const currentFiles = new Set(context.currentFiles);
    const fileOverlap = [...itemFiles].filter(f => currentFiles.has(f)).length;
    
    if (fileOverlap > 0) score += 40 * Math.min(fileOverlap / 3, 1);
    if (context.currentFunction && item.metadata.functions?.includes(context.currentFunction)) {
      score += 30;
    }

    const itemKeywords = new Set(item.metadata.keywords || []);
    const activeKeywords = new Set(context.activeKeywords);
    const keywordOverlap = [...itemKeywords].filter(k => activeKeywords.has(k)).length;
    
    if (keywordOverlap > 0) score += 30 * Math.min(keywordOverlap / 5, 1);

    return Math.min(score, 100);
  }

  private scoreTemporal(item: ContextItem, context: ScoringContext): number {
    return 50; // TODO: Pattern analysis
  }

  private async scoreCausal(item: ContextItem, context: ScoringContext): Promise<number> {
    return 50; // TODO: Causal graph
  }

  private extractText(item: ContextItem): string {
    return [
      item.content,
      ...(item.metadata.files || []),
      ...(item.metadata.functions || []),
      ...(item.metadata.keywords || []),
    ].join(' ');
  }

  private generateReasoning(factors: RelevanceScore['factors'], score: number): string {
    const reasons: string[] = [];
    if (factors.recency > 80) reasons.push('very recent');
    if (factors.semantic > 70) reasons.push('semantically similar');
    if (factors.structural > 60) reasons.push('related to current files');
    
    return reasons.length ? `High relevance: ${reasons.join(', ')}` 
                          : score > 50 ? 'Moderately relevant' : 'Low relevance';
  }
}

export function createRelevanceScorer(config?: OpenAIConfig): RelevanceScorer {
  return new RelevanceScorer(config);
}