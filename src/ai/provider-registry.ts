/**
 * AI Provider Registry
 * 
 * Central registry for managing multiple AI providers and routing requests
 * to the best available provider based on capabilities and user preferences.
 */

import { BaseAIProvider } from './interfaces/base-provider.js';

export interface ProviderRegistration {
  name: string;
  provider: BaseAIProvider;
  priority: number;
  enabled: boolean;
  fallback?: boolean;
}

export class AIProviderRegistry {
  private providers: Map<string, ProviderRegistration> = new Map();
  private defaultProvider?: string;
  private initializationPromise?: Promise<void>;

  /**
   * Register an AI provider with the registry
   */
  registerProvider(
    name: string, 
    provider: BaseAIProvider, 
    options: {
      priority?: number;
      enabled?: boolean;
      fallback?: boolean;
      setAsDefault?: boolean;
    } = {}
  ): void {
    const registration: ProviderRegistration = {
      name,
      provider,
      priority: options.priority ?? 10,
      enabled: options.enabled ?? true,
      fallback: options.fallback ?? false
    };

    this.providers.set(name, registration);

    // Set as default if specified or if it's the first provider
    if (options.setAsDefault || !this.defaultProvider) {
      this.defaultProvider = name;
    }

    console.log(`🤖 Registered AI provider: ${name} (priority: ${registration.priority})`);
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name?: string): BaseAIProvider | undefined {
    const providerName = name || this.defaultProvider;
    if (!providerName) return undefined;

    const registration = this.providers.get(providerName);
    return registration?.enabled ? registration.provider : undefined;
  }

  /**
   * Get all available (enabled and initialized) providers
   */
  getAvailableProviders(): ProviderRegistration[] {
    return Array.from(this.providers.values())
      .filter(reg => reg.enabled && reg.provider.isConfigured())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get the best available provider for a specific capability
   */
  getBestProvider(capability: string): BaseAIProvider | undefined {
    const available = this.getAvailableProviders();
    
    // Find providers that support the capability
    const capable = available.filter(reg => 
      reg.provider.getProviderInfo().capabilities.includes(capability)
    );

    if (capable.length === 0) {
      console.warn(`No providers found for capability: ${capability}`);
      return undefined;
    }

    // Return the highest priority provider
    return capable[0].provider;
  }

  /**
   * Get provider with fallback logic
   */
  getProviderWithFallback(capability: string): BaseAIProvider | undefined {
    // Try to get the best provider first
    let provider = this.getBestProvider(capability);
    
    if (!provider) {
      // Try fallback providers
      const fallbacks = Array.from(this.providers.values())
        .filter(reg => reg.fallback && reg.enabled && reg.provider.isConfigured());
      
      if (fallbacks.length > 0) {
        provider = fallbacks[0].provider;
        console.log(`Using fallback provider for capability: ${capability}`);
      }
    }

    return provider;
  }

  /**
   * Initialize all registered providers
   */
  async initializeAll(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeProviders();
    return this.initializationPromise;
  }

  private async _initializeProviders(): Promise<void> {
    console.log('🔄 Initializing AI providers...');
    
    const initPromises = Array.from(this.providers.entries()).map(
      async ([name, registration]) => {
        try {
          const success = await registration.provider.initialize();
          if (!success) {
            console.warn(`❌ Failed to initialize provider: ${name}`);
            registration.enabled = false;
          } else {
            console.log(`✅ Initialized provider: ${name}`);
          }
          return { name, success };
        } catch (error: any) {
          console.error(`❌ Error initializing provider ${name}:`, error.message);
          registration.enabled = false;
          return { name, success: false };
        }
      }
    );

    const results = await Promise.all(initPromises);
    const successful = results.filter(r => r.success);
    
    console.log(`✅ Initialized ${successful.length}/${results.length} AI providers`);
    
    if (successful.length === 0) {
      console.warn('⚠️  No AI providers successfully initialized!');
    }
  }

  /**
   * Route a request to the best provider with automatic fallback
   */
  async routeRequest<T>(
    capability: string,
    operation: (provider: BaseAIProvider) => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    const provider = this.getProviderWithFallback(capability);
    
    if (!provider) {
      if (fallbackOperation) {
        console.log(`No providers available for ${capability}, using fallback`);
        return await fallbackOperation();
      }
      throw new Error(`No providers available for capability: ${capability}`);
    }

    try {
      return await operation(provider);
    } catch (error: any) {
      console.warn(`Provider ${provider.getProviderInfo().name} failed for ${capability}:`, error.message);
      
      // Try other providers
      const available = this.getAvailableProviders();
      const remainingProviders = available
        .filter(reg => reg.provider !== provider)
        .filter(reg => reg.provider.getProviderInfo().capabilities.includes(capability));

      for (const registration of remainingProviders) {
        try {
          console.log(`Retrying with provider: ${registration.name}`);
          return await operation(registration.provider);
        } catch (retryError) {
          console.warn(`Provider ${registration.name} also failed:`, retryError);
          continue;
        }
      }

      // All providers failed, try fallback if available
      if (fallbackOperation) {
        console.log(`All providers failed for ${capability}, using fallback`);
        return await fallbackOperation();
      }

      throw new Error(`All providers failed for capability: ${capability}. Last error: ${error.message}`);
    }
  }

  /**
   * Get registry statistics and health information
   */
  getRegistryInfo(): any {
    const registrations = Array.from(this.providers.values());
    const enabled = registrations.filter(r => r.enabled);
    const initialized = enabled.filter(r => r.provider.isConfigured());
    
    return {
      total: registrations.length,
      enabled: enabled.length,
      initialized: initialized.length,
      defaultProvider: this.defaultProvider,
      providers: registrations.map(reg => ({
        name: reg.name,
        enabled: reg.enabled,
        initialized: reg.provider.isConfigured(),
        priority: reg.priority,
        info: reg.provider.getProviderInfo(),
        usage: reg.provider.getUsageStats()
      }))
    };
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(name: string, enabled: boolean): boolean {
    const registration = this.providers.get(name);
    if (!registration) {
      console.warn(`Provider not found: ${name}`);
      return false;
    }

    registration.enabled = enabled;
    console.log(`Provider ${name} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Set provider priority (higher number = higher priority)
   */
  setProviderPriority(name: string, priority: number): boolean {
    const registration = this.providers.get(name);
    if (!registration) {
      console.warn(`Provider not found: ${name}`);
      return false;
    }

    registration.priority = priority;
    console.log(`Provider ${name} priority set to ${priority}`);
    return true;
  }

  /**
   * Set default provider
   */
  setDefaultProvider(name: string): boolean {
    if (!this.providers.has(name)) {
      console.warn(`Cannot set default: provider not found: ${name}`);
      return false;
    }

    this.defaultProvider = name;
    console.log(`Default provider set to: ${name}`);
    return true;
  }

  /**
   * Remove a provider from the registry
   */
  unregisterProvider(name: string): boolean {
    const success = this.providers.delete(name);
    
    if (success) {
      console.log(`Unregistered provider: ${name}`);
      
      // Update default if necessary
      if (this.defaultProvider === name) {
        const remaining = Array.from(this.providers.keys());
        this.defaultProvider = remaining.length > 0 ? remaining[0] : undefined;
      }
    }
    
    return success;
  }

  /**
   * Benchmark all providers for performance comparison
   */
  async benchmarkProviders(): Promise<any> {
    const results: any = {};
    const testText = 'This is a test for benchmarking AI provider performance.';
    
    for (const [name, registration] of this.providers) {
      if (!registration.enabled || !registration.provider.isConfigured()) {
        results[name] = { skipped: 'Provider not enabled or initialized' };
        continue;
      }

      const provider = registration.provider;
      const capabilities = provider.getProviderInfo().capabilities;
      results[name] = { info: provider.getProviderInfo(), benchmarks: {} };

      // Benchmark embeddings if supported
      if (capabilities.includes('embeddings')) {
        try {
          const start = Date.now();
          const embedding = await provider.generateEmbeddings(testText);
          results[name].benchmarks.embeddings = {
            duration: Date.now() - start,
            dimensions: embedding.embeddings.length,
            cost: embedding.cost,
            success: true
          };
        } catch (error: any) {
          results[name].benchmarks.embeddings = {
            success: false,
            error: error.message
          };
        }
      }

      // Benchmark completion if supported
      if (capabilities.includes('completion')) {
        try {
          const start = Date.now();
          const completion = await provider.generateCompletion(
            'Complete this sentence: AI providers are', 
            50
          );
          results[name].benchmarks.completion = {
            duration: Date.now() - start,
            tokenCount: completion.tokenCount,
            cost: completion.cost,
            success: true
          };
        } catch (error: any) {
          results[name].benchmarks.completion = {
            success: false,
            error: error.message
          };
        }
      }
    }

    return results;
  }
}

// Export singleton registry
export const aiProviderRegistry = new AIProviderRegistry();