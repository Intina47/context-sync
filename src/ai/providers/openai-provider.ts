/**
 * OpenAI Provider Implementation
 * 
 * This provider integrates with OpenAI's APIs using the user's own API key.
 * Users get full control over their usage and costs.
 */

import { BaseAIProvider, AIProviderConfig, EmbeddingResult, CompletionResult } from '../interfaces/base-provider.js';

interface OpenAIConfig extends AIProviderConfig {
  apiKey: string;
  organization?: string;
  models: {
    embeddings: string;
    completion: string;
    chat: string;
  };
}

interface OpenAIResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

interface OpenAICompletionResponse {
  choices: Array<{
    text?: string;
    message?: { content: string };
    finish_reason: string;
  }>;
  usage: { total_tokens: number };
}

export class OpenAIProvider extends BaseAIProvider {
  private client: any;
  private readonly baseUrl: string;
  private readonly pricingPerToken = {
    'text-embedding-3-small': 0.00000002, // $0.02 per 1M tokens
    'text-embedding-3-large': 0.00000013, // $0.13 per 1M tokens
    'text-embedding-ada-002': 0.0000001,  // $0.10 per 1M tokens
    'gpt-3.5-turbo': 0.0000005,           // $0.50 per 1M tokens (input)
    'gpt-4': 0.00003,                     // $30.00 per 1M tokens (input)
    'gpt-4o': 0.0000025,                  // $2.50 per 1M tokens (input)
    'gpt-4o-mini': 0.00000015            // $0.15 per 1M tokens (input)
  };

  constructor(config: OpenAIConfig) {
    super({
      ...config,
      models: {
        embeddings: config.models?.embeddings || 'text-embedding-3-small',
        completion: config.models?.completion || 'gpt-4o-mini',
        chat: config.models?.chat || 'gpt-4o-mini'
      }
    });
    
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async initialize(): Promise<boolean> {
    try {
      // Dynamic import to avoid bundling OpenAI SDK if not used
      const { OpenAI } = await import('openai');
      
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        organization: (this.config as OpenAIConfig).organization,
        baseURL: this.baseUrl
      });

      // Test the connection with a simple embedding call
      await this.client.embeddings.create({
        model: this.config.models.embeddings!,
        input: 'test',
        encoding_format: 'float'
      });

      this.isInitialized = true;
      return true;
    } catch (error: any) {
      console.error('Failed to initialize OpenAI provider:', error.message);
      return false;
    }
  }

  async generateEmbeddings(text: string): Promise<EmbeddingResult> {
    if (!this.isInitialized) {
      throw new Error('OpenAI provider not initialized');
    }

    try {
      const response = await this.withRetry(async () => {
        return await this.client.embeddings.create({
          model: this.config.models.embeddings!,
          input: text,
          encoding_format: 'float'
        });
      });

      const tokenCount = response.usage.total_tokens;
      const cost = this.calculateCost(this.config.models.embeddings!, tokenCount);

      this.trackUsage(tokenCount, cost);

      return {
        embeddings: response.data[0].embedding,
        tokenCount,
        cost,
        model: this.config.models.embeddings!
      };
    } catch (error: any) {
      throw new Error(`OpenAI embeddings failed: ${error.message}`);
    }
  }

  async generateCompletion(prompt: string, maxTokens: number = 1000): Promise<CompletionResult> {
    if (!this.isInitialized) {
      throw new Error('OpenAI provider not initialized');
    }

    try {
      const response = await this.withRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.config.models.completion!,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that provides concise, accurate responses.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: this.config.temperature || 0.1
        });
      });

      const choice = response.choices[0];
      const tokenCount = response.usage.total_tokens;
      const cost = this.calculateCost(this.config.models.completion!, tokenCount);

      this.trackUsage(tokenCount, cost);

      return {
        text: choice.message?.content || '',
        tokenCount,
        cost,
        model: this.config.models.completion!,
        finishReason: choice.finish_reason as any
      };
    } catch (error: any) {
      throw new Error(`OpenAI completion failed: ${error.message}`);
    }
  }

  getProviderInfo() {
    return {
      name: 'OpenAI',
      type: 'api',
      capabilities: ['embeddings', 'completion', 'chat', 'summarization'],
      requiresApiKey: true,
      costEstimate: 'low' as const,
      privacy: 'api' as const
    };
  }

  /**
   * Get detailed information about available models and pricing
   */
  getModelInfo() {
    return {
      embeddings: {
        'text-embedding-3-small': {
          dimensions: 1536,
          costPer1M: 0.02,
          performance: 'fast',
          recommended: true
        },
        'text-embedding-3-large': {
          dimensions: 3072,
          costPer1M: 0.13,
          performance: 'best',
          recommended: false
        },
        'text-embedding-ada-002': {
          dimensions: 1536,
          costPer1M: 0.10,
          performance: 'good',
          recommended: false,
          deprecated: true
        }
      },
      completion: {
        'gpt-4o-mini': {
          contextWindow: 128000,
          costPer1M: 0.15,
          performance: 'fast',
          recommended: true
        },
        'gpt-4o': {
          contextWindow: 128000,
          costPer1M: 2.50,
          performance: 'best',
          recommended: false
        },
        'gpt-3.5-turbo': {
          contextWindow: 16385,
          costPer1M: 0.50,
          performance: 'good',
          recommended: false
        }
      }
    };
  }

  /**
   * Estimate cost for a given operation
   */
  estimateCost(operation: 'embeddings' | 'completion', tokenCount: number): number {
    const model = operation === 'embeddings' 
      ? this.config.models.embeddings!
      : this.config.models.completion!;
    
    return this.calculateCost(model, tokenCount);
  }

  /**
   * Get usage recommendations based on current configuration
   */
  getUsageRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Model recommendations
    if (this.config.models.embeddings === 'text-embedding-ada-002') {
      recommendations.push('Consider upgrading to text-embedding-3-small for better performance at lower cost');
    }
    
    if (this.config.models.completion === 'gpt-4') {
      recommendations.push('Consider using gpt-4o-mini for routine tasks to reduce costs by 90%');
    }

    // Usage pattern recommendations
    const stats = this.getUsageStats();
    if (stats.estimatedCost > 10) {
      recommendations.push('Your monthly costs are above $10. Consider using local models for basic tasks');
    }

    if (stats.tokensUsed > 1000000) {
      recommendations.push('High usage detected. Consider Context Sync Cloud for better rate limits and cost optimization');
    }

    return recommendations;
  }

  private calculateCost(model: string, tokenCount: number): number {
    const pricePerToken = this.pricingPerToken[model as keyof typeof this.pricingPerToken] || 0.000001;
    return tokenCount * pricePerToken;
  }

  /**
   * Test different models to help users choose the best one
   */
  async benchmarkModels(testText: string = 'This is a test for benchmarking AI models'): Promise<any> {
    const results: any = {};
    
    // Test embeddings models
    const embeddingModels = ['text-embedding-3-small', 'text-embedding-3-large'];
    
    for (const model of embeddingModels) {
      try {
        const start = Date.now();
        const oldModel = this.config.models.embeddings;
        this.config.models.embeddings = model;
        
        const result = await this.generateEmbeddings(testText);
        const duration = Date.now() - start;
        
        results[model] = {
          success: true,
          duration,
          tokenCount: result.tokenCount,
          cost: result.cost,
          dimensions: result.embeddings.length
        };
        
        this.config.models.embeddings = oldModel; // Restore original
      } catch (error: any) {
        results[model] = {
          success: false,
          error: error.message
        };
      }
    }
    
    return results;
  }
}