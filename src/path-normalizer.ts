/**
 * Path normalization utilities for consistent path handling across platforms
 */

import * as path from 'path';
import * as fs from 'fs';

export class PathNormalizer {
  /**
   * Normalize a file system path for consistent storage and comparison
   * Handles: case sensitivity, path separators, trailing slashes, relative paths
   */
  static normalize(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Path must be a non-empty string');
    }

    let normalizedPath = inputPath.trim();
    
    // Convert to absolute path if relative
    if (!path.isAbsolute(normalizedPath)) {
      normalizedPath = path.resolve(normalizedPath);
    }
    
    // Normalize path separators and resolve . and .. segments
    normalizedPath = path.normalize(normalizedPath);
    
    // Remove trailing path separator (except for root)
    if (normalizedPath.length > 1 && normalizedPath.endsWith(path.sep)) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    // Handle case sensitivity based on platform
    if (process.platform === 'win32') {
      // Windows: normalize to lowercase for case-insensitive comparison
      normalizedPath = normalizedPath.toLowerCase();
    }
    
    return normalizedPath;
  }

  /**
   * Resolve symlinks to get the real path
   */
  static async resolveSymlinks(inputPath: string): Promise<string> {
    try {
      const realPath = await fs.promises.realpath(inputPath);
      return PathNormalizer.normalize(realPath);
    } catch (error) {
      // If realpath fails, return normalized original path
      return PathNormalizer.normalize(inputPath);
    }
  }

  /**
   * Check if two paths refer to the same location
   */
  static pathsEqual(path1: string, path2: string): boolean {
    try {
      const normalized1 = PathNormalizer.normalize(path1);
      const normalized2 = PathNormalizer.normalize(path2);
      return normalized1 === normalized2;
    } catch {
      return false;
    }
  }

  /**
   * Get a display-friendly version of the path
   * Keeps original case for display while using normalized version for storage
   */
  static getDisplayPath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      return inputPath;
    }

    let displayPath = inputPath.trim();
    
    // Convert to absolute path if relative
    if (!path.isAbsolute(displayPath)) {
      displayPath = path.resolve(displayPath);
    }
    
    // Normalize path separators and resolve . and .. segments
    displayPath = path.normalize(displayPath);
    
    // Remove trailing path separator (except for root)
    if (displayPath.length > 1 && displayPath.endsWith(path.sep)) {
      displayPath = displayPath.slice(0, -1);
    }
    
    return displayPath;
  }

  /**
   * Validate that a path is safe and within expected bounds
   */
  static validatePath(inputPath: string): { valid: boolean; reason?: string } {
    if (!inputPath || typeof inputPath !== 'string') {
      return { valid: false, reason: 'Path must be a non-empty string' };
    }

    const trimmed = inputPath.trim();
    if (!trimmed) {
      return { valid: false, reason: 'Path cannot be empty or just whitespace' };
    }

    // Check for dangerous path components
    const dangerous = ['..\\..\\..', '../../../', '\\\\', '//', '\\0', '\0'];
    for (const danger of dangerous) {
      if (trimmed.includes(danger)) {
        return { valid: false, reason: 'Path contains potentially dangerous components' };
      }
    }

    // Check path length (reasonable limits)
    if (trimmed.length > 260 && process.platform === 'win32') {
      return { valid: false, reason: 'Path exceeds Windows maximum length (260 characters)' };
    }
    
    if (trimmed.length > 1024) {
      return { valid: false, reason: 'Path exceeds reasonable maximum length (1024 characters)' };
    }

    return { valid: true };
  }
}
