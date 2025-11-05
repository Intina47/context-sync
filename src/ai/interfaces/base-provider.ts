/**
 * Base AI Provider Interface
 * 
 * This defines the contract that all AI providers must implement,
 * enabling Context Sync to work with any AI service seamlessly.
 */

export interface AIProviderConfig {
  name: string;
  type: 'openai' | 'anthropic' | 'local' | 'managed' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  models: {
    embeddings?: string;
    completion?: string;
    chat?: string;
  };
  maxTokens?: number;
  temperature?: number;
  options?: Record<string, any>;
}

export interface EmbeddingResult {
  embeddings: number[];
  tokenCount: number;
  cost?: number;
  model: string;
}

export interface CompletionResult {
  text: string;
  tokenCount: number;
  cost?: number;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface RelevanceScore {
  score: number;
  confidence: number;
  method: 'semantic' | 'keyword' | 'hybrid';
  reasoning?: string;
}

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;
  protected isInitialized: boolean = false;
  protected usageStats = {
    tokensUsed: 0,
    requestCount: 0,
    estimatedCost: 0
  };

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Initialize the provider and verify it's working
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Generate embeddings for text
   */
  abstract generateEmbeddings(text: string): Promise<EmbeddingResult>;

  /**
   * Generate text completion
   */
  abstract generateCompletion(
    prompt: string, 
    maxTokens?: number
  ): Promise<CompletionResult>;

  /**
   * Score relevance between context and query
   */
  async scoreRelevance(context: string, query: string): Promise<RelevanceScore> {
    // Default implementation uses embeddings similarity
    try {
      const [contextEmbed, queryEmbed] = await Promise.all([
        this.generateEmbeddings(context),
        this.generateEmbeddings(query)
      ]);

      const similarity = this.cosineSimilarity(
        contextEmbed.embeddings,
        queryEmbed.embeddings
      );

      return {
        score: similarity,
        confidence: 0.8, // Embeddings are generally reliable
        method: 'semantic',
        reasoning: `Semantic similarity using ${this.config.models.embeddings}`
      };
    } catch (error) {
      // Fallback to keyword matching
      return this.keywordRelevanceScore(context, query);
    }
  }

  /**
   * Summarize text to fit within token limit
   */
  async summarizeText(text: string, targetTokens: number): Promise<CompletionResult> {
    const prompt = `Summarize the following text in approximately ${targetTokens} tokens, preserving key information:\n\n${text}`;
    return await this.generateCompletion(prompt, targetTokens);
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return this.isInitialized;
  }

  /**
   * Get provider information and capabilities
   */
  abstract getProviderInfo(): {
    name: string;
    type: string;
    capabilities: string[];
    requiresApiKey: boolean;
    costEstimate: 'free' | 'low' | 'medium' | 'high' | 'managed';
    privacy: 'local' | 'api' | 'managed';
  };

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return { ...this.usageStats };
  }

  /**
   * Protected utility methods
   */
  protected trackUsage(tokenCount: number, cost: number = 0): void {
    this.usageStats.tokensUsed += tokenCount;
    this.usageStats.requestCount += 1;
    this.usageStats.estimatedCost += cost;
  }

  protected estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  protected cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
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

  protected keywordRelevanceScore(context: string, query: string): RelevanceScore {
    const contextWords = this.extractKeywords(context.toLowerCase());
    const queryWords = this.extractKeywords(query.toLowerCase());
    
    const intersection = contextWords.filter(word => queryWords.includes(word));
    const union = [...new Set([...contextWords, ...queryWords])];
    
    const score = intersection.length / union.length;
    
    return {
      score,
      confidence: 0.6, // Keyword matching is less reliable
      method: 'keyword',
      reasoning: `Found ${intersection.length} matching keywords out of ${union.length} total`
    };
  }

  private extractKeywords(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those'];
    return stopWords.includes(word);
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff for rate limits
        if (error?.status === 429 || error?.message?.includes('rate limit')) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}