import * as fs from 'fs';
import * as path from 'path';

export interface FileSizeConfig {
  maxFileSize: number;      // Maximum size for a single file (bytes)
  maxTotalSize: number;     // Maximum total size for all files in an operation (bytes)
  skipLargeFiles: boolean;  // Whether to skip large files (true) or throw error (false)
}

export interface SafeReadResult {
  content: string;
  skipped: boolean;
  reason?: string;
  size: number;
}

export class FileSizeGuard {
  private static readonly DEFAULT_CONFIG: FileSizeConfig = {
    maxFileSize: 10 * 1024 * 1024,      // 10MB per file
    maxTotalSize: 100 * 1024 * 1024,    // 100MB total
    skipLargeFiles: true,                // Skip rather than error
  };

  private totalBytesRead = 0;
  private config: FileSizeConfig;

  constructor(config?: Partial<FileSizeConfig>) {
    this.config = { ...FileSizeGuard.DEFAULT_CONFIG, ...config };
  }

  /**
   * Safely read a file with size limits
   */
  readFile(filePath: string, encoding: BufferEncoding = 'utf8'): SafeReadResult {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Check individual file size limit
      if (fileSize > this.config.maxFileSize) {
        if (this.config.skipLargeFiles) {
          return {
            content: '',
            skipped: true,
            reason: `File too large: ${this.formatSize(fileSize)} > ${this.formatSize(this.config.maxFileSize)}`,
            size: fileSize,
          };
        } else {
          throw new Error(`File too large: ${filePath} (${this.formatSize(fileSize)} > ${this.formatSize(this.config.maxFileSize)})`);
        }
      }

      // Check total size limit
      if (this.totalBytesRead + fileSize > this.config.maxTotalSize) {
        if (this.config.skipLargeFiles) {
          return {
            content: '',
            skipped: true,
            reason: `Total size limit would be exceeded: ${this.formatSize(this.totalBytesRead + fileSize)} > ${this.formatSize(this.config.maxTotalSize)}`,
            size: fileSize,
          };
        } else {
          throw new Error(`Total size limit exceeded: ${this.formatSize(this.totalBytesRead + fileSize)} > ${this.formatSize(this.config.maxTotalSize)}`);
        }
      }

      // Read the file
      const content = fs.readFileSync(filePath, encoding);
      this.totalBytesRead += fileSize;

      return {
        content,
        skipped: false,
        size: fileSize,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          content: '',
          skipped: true,
          reason: error.message,
          size: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Reset the total bytes counter
   */
  reset(): void {
    this.totalBytesRead = 0;
  }

  /**
   * Get current statistics
   */
  getStats(): { totalBytesRead: number; maxTotalSize: number; remainingBytes: number } {
    return {
      totalBytesRead: this.totalBytesRead,
      maxTotalSize: this.config.maxTotalSize,
      remainingBytes: this.config.maxTotalSize - this.totalBytesRead,
    };
  }

  /**
   * Format bytes as human-readable string
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Check if a file would exceed limits without reading
   */
  wouldExceedLimits(filePath: string): { exceeds: boolean; reason?: string } {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      if (fileSize > this.config.maxFileSize) {
        return {
          exceeds: true,
          reason: `File too large: ${this.formatSize(fileSize)} > ${this.formatSize(this.config.maxFileSize)}`,
        };
      }

      if (this.totalBytesRead + fileSize > this.config.maxTotalSize) {
        return {
          exceeds: true,
          reason: `Total size limit would be exceeded: ${this.formatSize(this.totalBytesRead + fileSize)} > ${this.formatSize(this.config.maxTotalSize)}`,
        };
      }

      return { exceeds: false };
    } catch (error) {
      return {
        exceeds: true,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Convenience function for one-off safe file reads
 */
export function safeReadFile(filePath: string, config?: Partial<FileSizeConfig>): SafeReadResult {
  const guard = new FileSizeGuard(config);
  return guard.readFile(filePath);
}