/**
 * Context Compressor - Intelligent context compression
 * 
 * Solves: Keeping context within token budgets while maintaining quality
 */

import { ContextItem, RelevanceScore } from './relevance-scorer.js';

interface LLMConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  maxTokens?: number;
}

interface SummarizationCache {
  [key: string]: string;
}

export interface CompressionStrategy {
  name: 'aggressive' | 'balanced' | 'conservative';
  targetReduction: number; // percentage
  preserveTypes: ContextItem['type'][];
}

export interface CompressionResult {
  original: ContextItem[];
  compressed: ContextItem[];
  tokensRemoved: number;
  itemsRemoved: number;
  compressionRatio: number;
  summary: string;
}

export class ContextCompressor {
  private llmConfig: LLMConfig;
  private summarizationCache: SummarizationCache = {};
  private useLLM: boolean;

  constructor(config: LLMConfig = {}) {
    this.llmConfig = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      apiUrl: config.apiUrl || 'https://api.openai.com/v1/chat/completions',
      model: config.model || 'gpt-3.5-turbo',
      maxTokens: config.maxTokens || 150,
      ...config
    };
    this.useLLM = !!this.llmConfig.apiKey;
  }
  
  /**
   * Compress context to fit within token budget
   */
  async compress(
    items: Array<ContextItem & { relevanceScore: RelevanceScore }>,
    maxTokens: number,
    strategy: CompressionStrategy = {
      name: 'balanced',
      targetReduction: 0.5,
      preserveTypes: ['decision'],
    }
  ): Promise<CompressionResult> {
    
    const originalTokens = items.reduce((sum, item) => sum + item.tokens, 0);
    
    if (originalTokens <= maxTokens) {
      return {
        original: items,
        compressed: items,
        tokensRemoved: 0,
        itemsRemoved: 0,
        compressionRatio: 1,
        summary: 'No compression needed',
      };
    }

    let compressed = [...items];
    
    // Step 1: Remove low-relevance items
    compressed = this.removeByRelevance(compressed, strategy);
    
    // Step 2: Summarize verbose items
    compressed = await this.summarizeVerbose(compressed, maxTokens);
    
    // Step 3: Merge similar items
    compressed = await this.mergeSimilar(compressed);
    
    const compressedTokens = compressed.reduce((sum, item) => sum + item.tokens, 0);
    
    return {
      original: items,
      compressed,
      tokensRemoved: originalTokens - compressedTokens,
      itemsRemoved: items.length - compressed.length,
      compressionRatio: compressedTokens / originalTokens,
      summary: this.generateCompressionSummary(items.length, compressed.length, originalTokens, compressedTokens),
    };
  }

  /**
   * Remove items below relevance threshold
   */
  private removeByRelevance(
    items: Array<ContextItem & { relevanceScore: RelevanceScore }>,
    strategy: CompressionStrategy
  ): Array<ContextItem & { relevanceScore: RelevanceScore }> {
    
    const thresholds = {
      aggressive: 60,
      balanced: 40,
      conservative: 20,
    };
    
    const threshold = thresholds[strategy.name];
    
    return items.filter(item => {
      // Always preserve certain types
      if (strategy.preserveTypes.includes(item.type)) return true;
      
      // Filter by relevance
      return item.relevanceScore.score >= threshold;
    });
  }

  /**
   * Summarize verbose context items
   */
  private async summarizeVerbose(
    items: Array<ContextItem & { relevanceScore: RelevanceScore }>,
    maxTokens: number
  ): Promise<Array<ContextItem & { relevanceScore: RelevanceScore }>> {
    
    const currentTokens = items.reduce((sum, item) => sum + item.tokens, 0);
    if (currentTokens <= maxTokens) return items;
    
    // Find items that are too long
    const tokenThreshold = 500; // Items over this get summarized
    
    const processedItems = await Promise.all(items.map(async (item) => {
      if (item.tokens <= tokenThreshold) return item;
      
      // Summarize the content
      const summary = await this.summarizeText(item.content);
      
      return {
        ...item,
        content: `[Summarized] ${summary}`,
        tokens: Math.floor(item.tokens * 0.3), // Estimate 70% reduction
        metadata: {
          ...item.metadata,
          original_tokens: item.tokens,
          summarized: true,
        },
      };
    }));

    return processedItems;
  }

  /**
   * Advanced text summarization using LLM or fallback to simple method
   */
  private async summarizeText(text: string, maxLength: number = 200): Promise<string> {
    if (text.length <= maxLength) return text;

    if (this.useLLM) {
      try {
        return await this.summarizeWithLLM(text, maxLength);
      } catch (error) {
        console.warn('LLM summarization failed, falling back to simple method:', error);
      }
    }

    return this.summarizeSimple(text, maxLength);
  }

  /**
   * Advanced summarization using LLM
   */
  private async summarizeWithLLM(text: string, maxLength: number): Promise<string> {
    // Check cache first
    const cacheKey = this.hashString(text + maxLength);
    if (this.summarizationCache[cacheKey]) {
      return this.summarizationCache[cacheKey];
    }

    const prompt = `Please summarize the following context in ${Math.floor(maxLength / 4)} words or less, focusing on key decisions, important information, and actionable items. Keep technical details that might be relevant for development work.

Context:
${text.slice(0, 2000)} ${text.length > 2000 ? '...' : ''}

Summary:`;

    const response = await fetch(this.llmConfig.apiUrl!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.llmConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.llmConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a technical documentation expert. Create concise, informative summaries that preserve key technical information and decisions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.llmConfig.maxTokens,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    const summary = data.choices[0].message.content.trim();
    
    // Cache the result
    this.summarizationCache[cacheKey] = summary;
    
    return summary;
  }

  /**
   * Simple fallback summarization
   */
  private summarizeSimple(text: string, maxLength: number = 200): string {
    // Extract key sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    // Take first and last sentences, plus any with keywords
    const keywords = ['decision', 'because', 'important', 'chose', 'using', 'implemented', 'fixed', 'added', 'removed'];
    const keySentences = sentences.filter(s => 
      keywords.some(kw => s.toLowerCase().includes(kw))
    );
    
    const summary = [
      sentences[0],
      ...keySentences.slice(0, 2),
      sentences[sentences.length - 1],
    ].filter(Boolean).join('. ').substring(0, maxLength);
    
    return summary + (summary.length < text.length ? '...' : '');
  }

  /**
   * Hash function for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Merge similar context items
   */
  private async mergeSimilar(
    items: Array<ContextItem & { relevanceScore: RelevanceScore }>
  ): Promise<Array<ContextItem & { relevanceScore: RelevanceScore }>> {
    if (items.length < 2) return items;

    const groups: Array<Array<ContextItem & { relevanceScore: RelevanceScore }>> = [];
    const processed = new Set<string>();

    // Group similar items
    for (let i = 0; i < items.length; i++) {
      if (processed.has(items[i].id)) continue;

      const group = [items[i]];
      processed.add(items[i].id);

      // Find similar items
      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(items[j].id)) continue;
        
        if (await this.areItemsSimilar(items[i], items[j])) {
          group.push(items[j]);
          processed.add(items[j].id);
        }
      }

      groups.push(group);
    }

    // Merge groups with multiple items
    const mergedItems: Array<ContextItem & { relevanceScore: RelevanceScore }> = [];

    for (const group of groups) {
      if (group.length === 1) {
        mergedItems.push(group[0]);
      } else {
        const merged = await this.mergeGroup(group);
        mergedItems.push(merged);
      }
    }

    return mergedItems;
  }

  /**
   * Check if two context items are similar enough to merge
   */
  private async areItemsSimilar(
    item1: ContextItem & { relevanceScore: RelevanceScore },
    item2: ContextItem & { relevanceScore: RelevanceScore }
  ): Promise<boolean> {
    // Must be same type
    if (item1.type !== item2.type) return false;

    // Check file overlap
    const files1 = new Set(item1.metadata.files || []);
    const files2 = new Set(item2.metadata.files || []);
    const fileIntersection = new Set([...files1].filter(f => files2.has(f)));
    const fileUnion = new Set([...files1, ...files2]);
    
    if (fileUnion.size > 0 && fileIntersection.size / fileUnion.size > 0.6) {
      return true;
    }

    // Check content similarity
    const similarity = this.calculateTextSimilarity(item1.content, item2.content);
    return similarity > 0.7;
  }

  /**
   * Merge a group of similar items
   */
  private async mergeGroup(
    group: Array<ContextItem & { relevanceScore: RelevanceScore }>
  ): Promise<ContextItem & { relevanceScore: RelevanceScore }> {
    const representative = group[0];
    
    // Combine content
    const combinedContent = group.map(item => item.content).join('\n\n---\n\n');
    
    // Summarize if it's getting too long
    const maxLength = 800;
    const finalContent = combinedContent.length > maxLength ?
      await this.summarizeText(combinedContent, maxLength) :
      combinedContent;

    // Merge metadata
    const allFiles = [...new Set(group.flatMap(item => item.metadata.files || []))];
    const allFunctions = [...new Set(group.flatMap(item => item.metadata.functions || []))];
    const allKeywords = [...new Set(group.flatMap(item => item.metadata.keywords || []))];
    
    // Use highest relevance score
    const bestScore = group.reduce((best, item) => 
      item.relevanceScore.score > best.relevanceScore.score ? item : best
    );

    return {
      ...representative,
      content: `[Merged from ${group.length} items] ${finalContent}`,
      tokens: Math.floor(finalContent.length / 4), // Rough estimate
      metadata: {
        ...representative.metadata,
        files: allFiles,
        functions: allFunctions,
        keywords: allKeywords,
      },
      relevanceScore: bestScore.relevanceScore,
    };
  }

  /**
   * Calculate text similarity using word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Clear the summarization cache
   */
  public clearCache(): void {
    this.summarizationCache = {};
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { summaries: number; totalSize: number } {
    const keys = Object.keys(this.summarizationCache);
    const totalSize = keys.reduce((sum, key) => sum + this.summarizationCache[key].length, 0);
    
    return {
      summaries: keys.length,
      totalSize
    };
  }

  /**
   * Check if LLM is enabled for summarization
   */
  public isLLMEnabled(): boolean {
    return this.useLLM;
  }

  private generateCompressionSummary(
    originalCount: number,
    compressedCount: number,
    originalTokens: number,
    compressedTokens: number
  ): string {
    const itemReduction = ((originalCount - compressedCount) / originalCount * 100).toFixed(1);
    const tokenReduction = ((originalTokens - compressedTokens) / originalTokens * 100).toFixed(1);
    
    return `Reduced from ${originalCount} items (${originalTokens} tokens) to ${compressedCount} items (${compressedTokens} tokens). ${itemReduction}% fewer items, ${tokenReduction}% fewer tokens.`;
  }
}

export function createContextCompressor(config?: LLMConfig): ContextCompressor {
  return new ContextCompressor(config);
}