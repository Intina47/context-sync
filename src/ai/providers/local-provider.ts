/**
 * Local AI Provider Implementation
 * 
 * This provider runs AI models locally using transformers.js,
 * providing complete privacy and zero API costs.
 */

import { BaseAIProvider, AIProviderConfig, EmbeddingResult, CompletionResult } from '../interfaces/base-provider.js';

interface LocalConfig extends AIProviderConfig {
  models: {
    embeddings: string;
    completion?: string;
  };
  device?: 'cpu' | 'gpu';
  maxConcurrency?: number;
}

export class LocalProvider extends BaseAIProvider {
  private embeddingPipeline: any;
  private completionPipeline: any;
  private isLoading: boolean = false;
  private readonly supportedModels = {
    embeddings: [
      'Xenova/all-MiniLM-L6-v2',           // Fast, 384 dimensions
      'Xenova/all-mpnet-base-v2',          // Better quality, 768 dimensions  
      'Xenova/sentence-t5-base',           // Good balance, 768 dimensions
      'Xenova/multi-qa-MiniLM-L6-cos-v1'   // Question-answering focused
    ],
    completion: [
      'Xenova/gpt2',                       // Basic text generation
      'Xenova/distilgpt2',                 // Faster GPT-2 variant
      'Xenova/CodeBERTa-small-v1'          // Code generation (experimental)
    ]
  };

  constructor(config: LocalConfig) {
    super({
      ...config,
      type: 'local',
      models: {
        embeddings: config.models?.embeddings || 'Xenova/all-MiniLM-L6-v2',
        completion: config.models?.completion || 'Xenova/gpt2'
      }
    });
  }

  async initialize(): Promise<boolean> {
    if (this.isLoading) {
      return false; // Prevent concurrent initialization
    }

    try {
      this.isLoading = true;

      // Dynamic import to avoid bundling transformers.js if not used
      const { pipeline } = await import('@xenova/transformers');

      console.log('Loading local AI models... (this may take a moment on first run)');

      // Initialize embedding pipeline
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.config.models.embeddings!,
        {
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              console.log(`Downloading ${this.config.models.embeddings}: ${progress.progress}%`);
            }
          }
        }
      );

      // Initialize completion pipeline (optional)
      if (this.config.models.completion) {
        try {
          this.completionPipeline = await pipeline(
            'text-generation',
            this.config.models.completion
          );
        } catch (error) {
          console.warn('Could not load completion model, completion features disabled:', error);
        }
      }

      this.isInitialized = true;
      console.log('✅ Local AI models loaded successfully');
      return true;

    } catch (error: any) {
      console.error('Failed to initialize local AI provider:', error.message);
      console.log('💡 Tip: Ensure you have internet connection for the first model download');
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async generateEmbeddings(text: string): Promise<EmbeddingResult> {
    if (!this.isInitialized || !this.embeddingPipeline) {
      throw new Error('Local AI provider not initialized or embedding model not loaded');
    }

    try {
      const start = Date.now();
      
      // Generate embeddings using transformers.js
      const result = await this.embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true
      });

      const embeddings = Array.from(result.data) as number[];
      const tokenCount = this.estimateTokenCount(text);
      const duration = Date.now() - start;

      this.trackUsage(tokenCount, 0); // Local processing is free

      console.log(`Generated ${embeddings.length}D embeddings locally in ${duration}ms`);

      return {
        embeddings,
        tokenCount,
        cost: 0, // Local processing is free
        model: this.config.models.embeddings!
      };

    } catch (error: any) {
      throw new Error(`Local embeddings failed: ${error.message}`);
    }
  }

  async generateCompletion(prompt: string, maxTokens: number = 100): Promise<CompletionResult> {
    if (!this.completionPipeline) {
      throw new Error('Local completion model not available. Only embeddings are supported in this configuration.');
    }

    try {
      const start = Date.now();

      const result = await this.completionPipeline(prompt, {
        max_new_tokens: Math.min(maxTokens, 200), // Limit for performance
        temperature: this.config.temperature || 0.7,
        do_sample: true,
        pad_token_id: this.completionPipeline.tokenizer.eos_token_id
      });

      const generatedText = result[0].generated_text;
      const responseText = generatedText.slice(prompt.length).trim();
      const tokenCount = this.estimateTokenCount(responseText);
      const duration = Date.now() - start;

      this.trackUsage(tokenCount, 0);

      console.log(`Generated ${tokenCount} tokens locally in ${duration}ms`);

      return {
        text: responseText,
        tokenCount,
        cost: 0,
        model: this.config.models.completion!,
        finishReason: 'stop'
      };

    } catch (error: any) {
      throw new Error(`Local completion failed: ${error.message}`);
    }
  }

  /**
   * Enhanced relevance scoring using local embeddings
   */
  async scoreRelevance(context: string, query: string): Promise<any> {
    try {
      // Use semantic similarity with local embeddings
      const result = await super.scoreRelevance(context, query);
      return {
        ...result,
        method: 'local-semantic'
      };
    } catch (error) {
      // Fallback to keyword matching
      return this.keywordRelevanceScore(context, query);
    }
  }

  getProviderInfo() {
    return {
      name: 'Local AI (Transformers.js)',
      type: 'local',
      capabilities: this.completionPipeline 
        ? ['embeddings', 'completion', 'relevance']
        : ['embeddings', 'relevance'],
      requiresApiKey: false,
      costEstimate: 'free' as const,
      privacy: 'local' as const
    };
  }

  /**
   * Get information about available local models
   */
  getAvailableModels() {
    return {
      embeddings: this.supportedModels.embeddings.map(model => ({
        name: model,
        dimensions: this.getModelDimensions(model),
        size: this.getModelSize(model),
        speed: this.getModelSpeed(model),
        recommended: model === 'Xenova/all-MiniLM-L6-v2'
      })),
      completion: this.supportedModels.completion.map(model => ({
        name: model,
        size: this.getModelSize(model),
        quality: this.getModelQuality(model),
        experimental: true
      }))
    };
  }

  /**
   * Switch to a different local model
   */
  async switchModel(type: 'embeddings' | 'completion', modelName: string): Promise<boolean> {
    if (!this.supportedModels[type].includes(modelName)) {
      throw new Error(`Unsupported ${type} model: ${modelName}`);
    }

    try {
      const { pipeline } = await import('@xenova/transformers');
      
      if (type === 'embeddings') {
        console.log(`Switching to embedding model: ${modelName}`);
        this.embeddingPipeline = await pipeline('feature-extraction', modelName);
        this.config.models.embeddings = modelName;
      } else {
        console.log(`Switching to completion model: ${modelName}`);
        this.completionPipeline = await pipeline('text-generation', modelName);
        this.config.models.completion = modelName;
      }

      return true;
    } catch (error: any) {
      console.error(`Failed to switch to model ${modelName}:`, error.message);
      return false;
    }
  }

  /**
   * Get performance benchmarks for the current setup
   */
  async benchmarkPerformance(): Promise<any> {
    const testText = 'This is a benchmark test for local AI model performance.';
    const results: any = {};

    // Benchmark embeddings
    if (this.embeddingPipeline) {
      const start = Date.now();
      try {
        const embedding = await this.generateEmbeddings(testText);
        results.embeddings = {
          duration: Date.now() - start,
          dimensions: embedding.embeddings.length,
          model: this.config.models.embeddings,
          success: true
        };
      } catch (error: any) {
        results.embeddings = {
          success: false,
          error: error.message
        };
      }
    }

    // Benchmark completion
    if (this.completionPipeline) {
      const start = Date.now();
      try {
        const completion = await this.generateCompletion('Complete this sentence: The local AI model is', 20);
        results.completion = {
          duration: Date.now() - start,
          tokensPerSecond: completion.tokenCount / ((Date.now() - start) / 1000),
          model: this.config.models.completion,
          success: true
        };
      } catch (error: any) {
        results.completion = {
          success: false,
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Get system requirements and recommendations
   */
  getSystemRequirements() {
    return {
      minimum: {
        ram: '4GB',
        storage: '2GB for models',
        cpu: 'Any modern CPU'
      },
      recommended: {
        ram: '8GB+',
        storage: '5GB for multiple models',
        cpu: 'Multi-core CPU for faster processing'
      },
      gpu: {
        supported: false, // transformers.js currently uses CPU
        note: 'GPU acceleration coming in future versions'
      },
      performance: {
        'Xenova/all-MiniLM-L6-v2': 'Fast embeddings, good quality',
        'Xenova/all-mpnet-base-v2': 'Slower but better quality',
        'Xenova/gpt2': 'Basic text generation, experimental'
      }
    };
  }

  private getModelDimensions(model: string): number {
    const dimensions: Record<string, number> = {
      'Xenova/all-MiniLM-L6-v2': 384,
      'Xenova/all-mpnet-base-v2': 768,
      'Xenova/sentence-t5-base': 768,
      'Xenova/multi-qa-MiniLM-L6-cos-v1': 384
    };
    return dimensions[model] || 384;
  }

  private getModelSize(model: string): string {
    const sizes: Record<string, string> = {
      'Xenova/all-MiniLM-L6-v2': '23MB',
      'Xenova/all-mpnet-base-v2': '438MB', 
      'Xenova/sentence-t5-base': '219MB',
      'Xenova/multi-qa-MiniLM-L6-cos-v1': '23MB',
      'Xenova/gpt2': '548MB',
      'Xenova/distilgpt2': '353MB'
    };
    return sizes[model] || 'Unknown';
  }

  private getModelSpeed(model: string): 'fast' | 'medium' | 'slow' {
    const speeds: Record<string, 'fast' | 'medium' | 'slow'> = {
      'Xenova/all-MiniLM-L6-v2': 'fast',
      'Xenova/all-mpnet-base-v2': 'medium',
      'Xenova/sentence-t5-base': 'medium',
      'Xenova/multi-qa-MiniLM-L6-cos-v1': 'fast'
    };
    return speeds[model] || 'medium';
  }

  private getModelQuality(model: string): 'basic' | 'good' | 'excellent' {
    const quality: Record<string, 'basic' | 'good' | 'excellent'> = {
      'Xenova/gpt2': 'basic',
      'Xenova/distilgpt2': 'basic',
      'Xenova/CodeBERTa-small-v1': 'good'
    };
    return quality[model] || 'basic';
  }
}