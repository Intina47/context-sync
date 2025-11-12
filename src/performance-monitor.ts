/**
 * Performance monitoring utilities for Context Sync operations
 */

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  memoryUsage?: NodeJS.MemoryUsage;
  metadata?: any;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 operations
  
  /**
   * Start timing an operation
   */
  static startTimer(operation: string): () => PerformanceMetrics {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    return (metadata?: any): PerformanceMetrics => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const endMemory = process.memoryUsage();
      
      const metric: PerformanceMetrics = {
        operation,
        duration,
        timestamp: Date.now(),
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        },
        metadata,
      };
      
      this.recordMetric(metric);
      return metric;
    };
  }
  
  /**
   * Record a performance metric
   */
  private static recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics to prevent memory bloat
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }
  
  /**
   * Get performance statistics for operations
   */
  static getStats(operation?: string): {
    count: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    recentMetrics: PerformanceMetrics[];
  } {
    const relevantMetrics = operation 
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;
    
    if (relevantMetrics.length === 0) {
      return {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        recentMetrics: [],
      };
    }
    
    const durations = relevantMetrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    
    return {
      count: relevantMetrics.length,
      totalDuration,
      averageDuration: totalDuration / relevantMetrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      recentMetrics: relevantMetrics.slice(-10), // Last 10 operations
    };
  }
  
  /**
   * Get all operation types with their stats
   */
  static getAllOperationStats(): Record<string, ReturnType<typeof PerformanceMonitor.getStats>> {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    const stats: Record<string, ReturnType<typeof PerformanceMonitor.getStats>> = {};
    
    for (const operation of operations) {
      stats[operation] = this.getStats(operation);
    }
    
    return stats;
  }
  
  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
  }
  
  /**
   * Get a performance report
   */
  static getReport(): string {
    const allStats = this.getAllOperationStats();
    const operations = Object.keys(allStats).sort();
    
    if (operations.length === 0) {
      return '📊 **Performance Report**: No metrics recorded yet.';
    }
    
    let report = '📊 **Performance Report**\n\n';
    report += `Total Operations: ${this.metrics.length}\n`;
    report += `Unique Operation Types: ${operations.length}\n\n`;
    
    report += '| Operation | Count | Avg (ms) | Min (ms) | Max (ms) | Total (ms) |\n';
    report += '|-----------|-------|----------|----------|----------|------------|\n';
    
    for (const operation of operations) {
      const stats = allStats[operation];
      report += `| ${operation} | ${stats.count} | ${stats.averageDuration.toFixed(2)} | ${stats.minDuration.toFixed(2)} | ${stats.maxDuration.toFixed(2)} | ${stats.totalDuration.toFixed(2)} |\n`;
    }
    
    // Show slowest operations
    const allMetrics = this.metrics.slice().sort((a, b) => b.duration - a.duration);
    if (allMetrics.length > 0) {
      report += '\n**Slowest Recent Operations:**\n';
      allMetrics.slice(0, 5).forEach((metric, index) => {
        report += `${index + 1}. ${metric.operation}: ${metric.duration.toFixed(2)}ms\n`;
      });
    }
    
    return report;
  }
}