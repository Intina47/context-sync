/**
 * Project Cache - Layer 3: Optimization
 * Intelligent caching with invalidation based on git HEAD + file mtimes
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';

interface CacheEntry<T> {
  data: T;
  gitHead: string;
  manifestMtime: number;
  timestamp: number;
}

interface CacheKey {
  projectPath: string;
  gitHead: string;
  manifestMtime: number;
}

export class ProjectCache {
  private cache = new Map<string, CacheEntry<any>>();
  private ttlMs = 60 * 60 * 1000; // 1 hour

  /**
   * Get cached data if valid
   */
  async get<T>(projectPath: string): Promise<T | null> {
    const key = await this.getCacheKey(projectPath);
    if (!key) return null;

    const cacheKey = this.buildKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Validate cache still valid
    if (entry.gitHead !== key.gitHead || entry.manifestMtime !== key.manifestMtime) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  async set<T>(projectPath: string, data: T): Promise<void> {
    const key = await this.getCacheKey(projectPath);
    if (!key) return;

    const cacheKey = this.buildKey(key);
    this.cache.set(cacheKey, {
      data,
      gitHead: key.gitHead,
      manifestMtime: key.manifestMtime,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for a project
   */
  async invalidate(projectPath: string): Promise<void> {
    const key = await this.getCacheKey(projectPath);
    if (!key) return;

    const cacheKey = this.buildKey(key);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Build cache key from components
   */
  private buildKey(key: CacheKey): string {
    return `${key.projectPath.toLowerCase()}:${key.gitHead}:${key.manifestMtime}`;
  }

  /**
   * Get cache key components for a project
   */
  private async getCacheKey(projectPath: string): Promise<CacheKey | null> {
    try {
      // Get git HEAD
      const git = simpleGit(projectPath);
      let gitHead = 'no-git';
      
      try {
        const log = await git.log({ maxCount: 1 });
        gitHead = log.latest?.hash || 'no-commits';
      } catch (err) {
        // Not a git repo or no commits
      }

      // Get manifest file mtime (use the first that exists)
      const manifestFiles = [
        'package.json',
        'go.mod',
        'Cargo.toml',
        'pyproject.toml',
        'pom.xml',
        'build.gradle'
      ];

      let manifestMtime = 0;
      for (const file of manifestFiles) {
        try {
          const stat = await fs.stat(join(projectPath, file));
          manifestMtime = stat.mtimeMs;
          break;
        } catch (err) {
          continue;
        }
      }

      return {
        projectPath: projectPath.toLowerCase(),
        gitHead,
        manifestMtime
      };
    } catch (err) {
      return null;
    }
  }
}

// Global cache instance
export const projectCache = new ProjectCache();

