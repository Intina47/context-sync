import * as fs from 'fs';
import * as path from 'path';

export interface FileSkimmingConfig {
  maxFileSize: number;           // When to start skimming (bytes)
  skimChunkSize: number;         // Size of each chunk to read (bytes)
  headerSize: number;            // Always read from start (bytes)
  footerSize: number;            // Always read from end (bytes)
  searchPatterns?: string[];     // Patterns to look for while skimming
  maxChunks: number;             // Maximum chunks to read when skimming
  encoding: BufferEncoding;      // File encoding
}

export interface SkimmedContent {
  content: string;
  skimmed: boolean;
  originalSize: number;
  actualSize: number;
  chunks: SkimChunk[];
  patterns?: PatternMatch[];
}

export interface SkimChunk {
  start: number;    // Byte offset in original file
  end: number;      // Byte offset end
  type: 'header' | 'footer' | 'middle' | 'pattern';
  content: string;
}

export interface PatternMatch {
  pattern: string;
  line: number;
  context: string;
  byteOffset: number;
}

export class FileSkimmer {
  private static readonly DEFAULT_CONFIG: FileSkimmingConfig = {
    maxFileSize: 1 * 1024 * 1024,        // Start skimming at 1MB
    skimChunkSize: 64 * 1024,             // 64KB chunks
    headerSize: 32 * 1024,                // Read first 32KB
    footerSize: 16 * 1024,                // Read last 16KB
    maxChunks: 10,                        // Max 10 chunks (640KB total)
    encoding: 'utf8',
  };

  private config: FileSkimmingConfig;

  constructor(config?: Partial<FileSkimmingConfig>) {
    this.config = { ...FileSkimmer.DEFAULT_CONFIG, ...config };
  }

  /**
   * Smart file reading with skimming for large files
   */
  readFile(filePath: string, searchPatterns?: string[]): SkimmedContent {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // For small files, read normally
      if (fileSize <= this.config.maxFileSize) {
        const content = fs.readFileSync(filePath, this.config.encoding);
        return {
          content,
          skimmed: false,
          originalSize: fileSize,
          actualSize: content.length,
          chunks: [{
            start: 0,
            end: fileSize,
            type: 'header',
            content,
          }],
        };
      }

      // For large files, use intelligent skimming
      return this.skimFile(filePath, fileSize, searchPatterns || this.config.searchPatterns);

    } catch (error) {
      return {
        content: '',
        skimmed: false,
        originalSize: 0,
        actualSize: 0,
        chunks: [],
      };
    }
  }

  /**
   * Skim a large file intelligently
   */
  private skimFile(filePath: string, fileSize: number, searchPatterns?: string[]): SkimmedContent {
    const fd = fs.openSync(filePath, 'r');
    const chunks: SkimChunk[] = [];
    let totalContent = '';

    try {
      // 1. Always read header (beginning of file)
      const headerSize = Math.min(this.config.headerSize, fileSize);
      const headerBuffer = Buffer.alloc(headerSize);
      fs.readSync(fd, headerBuffer, 0, headerSize, 0);
      const headerContent = headerBuffer.toString(this.config.encoding);
      
      chunks.push({
        start: 0,
        end: headerSize,
        type: 'header',
        content: headerContent,
      });
      totalContent += headerContent;

      // 2. Always read footer (end of file)
      const footerSize = Math.min(this.config.footerSize, fileSize - headerSize);
      if (footerSize > 0) {
        const footerBuffer = Buffer.alloc(footerSize);
        const footerStart = fileSize - footerSize;
        fs.readSync(fd, footerBuffer, 0, footerSize, footerStart);
        const footerContent = footerBuffer.toString(this.config.encoding);
        
        chunks.push({
          start: footerStart,
          end: fileSize,
          type: 'footer',
          content: footerContent,
        });
        totalContent += '\n\n[... file content skipped ...]\n\n' + footerContent;
      }

      // 3. Pattern-based skimming if patterns provided
      let patterns: PatternMatch[] = [];
      if (searchPatterns && searchPatterns.length > 0) {
        const patternResult = this.searchPatterns(filePath, fileSize, searchPatterns, fd);
        patterns = patternResult.matches;
        
        // Add pattern chunks to content
        for (const match of patterns) {
          totalContent += `\n\n[... pattern match at line ${match.line} ...]\n${match.context}`;
        }
      }

      // 4. Strategic middle sampling (for files without specific patterns)
      if (!searchPatterns || searchPatterns.length === 0) {
        const middleChunks = this.sampleMiddleSections(fd, fileSize, headerSize, footerSize);
        chunks.push(...middleChunks);
        
        for (const chunk of middleChunks) {
          totalContent += '\n\n[... skipped content ...]\n' + chunk.content;
        }
      }

      return {
        content: totalContent,
        skimmed: true,
        originalSize: fileSize,
        actualSize: totalContent.length,
        chunks,
        patterns: patterns.length > 0 ? patterns : undefined,
      };

    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Search for specific patterns in large files
   */
  private searchPatterns(
    filePath: string, 
    fileSize: number, 
    patterns: string[], 
    fd: number
  ): { matches: PatternMatch[]; chunks: SkimChunk[] } {
    const matches: PatternMatch[] = [];
    const chunks: SkimChunk[] = [];
    const chunkSize = this.config.skimChunkSize;
    let currentOffset = 0;
    let processedChunks = 0;

    while (currentOffset < fileSize && processedChunks < this.config.maxChunks) {
      const readSize = Math.min(chunkSize, fileSize - currentOffset);
      const buffer = Buffer.alloc(readSize);
      fs.readSync(fd, buffer, 0, readSize, currentOffset);
      const content = buffer.toString(this.config.encoding);

      // Check for patterns in this chunk
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of patterns) {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            // Found a match! Include context
            const contextStart = Math.max(0, i - 2);
            const contextEnd = Math.min(lines.length, i + 3);
            const context = lines.slice(contextStart, contextEnd).join('\n');

            matches.push({
              pattern,
              line: Math.floor(currentOffset / 80) + i, // Rough line estimate
              context,
              byteOffset: currentOffset,
            });

            chunks.push({
              start: currentOffset,
              end: currentOffset + readSize,
              type: 'pattern',
              content: context,
            });
          }
        }
      }

      currentOffset += chunkSize;
      processedChunks++;
    }

    return { matches, chunks };
  }

  /**
   * Sample middle sections of large files strategically
   */
  private sampleMiddleSections(
    fd: number, 
    fileSize: number, 
    headerSize: number, 
    footerSize: number
  ): SkimChunk[] {
    const chunks: SkimChunk[] = [];
    const availableMiddle = fileSize - headerSize - footerSize;
    
    if (availableMiddle <= 0) return chunks;

    // Sample 3-5 strategic points in the middle
    const samplePoints = Math.min(5, this.config.maxChunks - 2); // -2 for header/footer
    const interval = Math.floor(availableMiddle / (samplePoints + 1));

    for (let i = 1; i <= samplePoints; i++) {
      const sampleStart = headerSize + (interval * i);
      const sampleSize = Math.min(this.config.skimChunkSize, availableMiddle - (interval * i));
      
      if (sampleSize > 0) {
        const buffer = Buffer.alloc(sampleSize);
        fs.readSync(fd, buffer, 0, sampleSize, sampleStart);
        const content = buffer.toString(this.config.encoding);

        chunks.push({
          start: sampleStart,
          end: sampleStart + sampleSize,
          type: 'middle',
          content,
        });
      }
    }

    return chunks;
  }

  /**
   * Get skimming statistics
   */
  getSkimmingInfo(result: SkimmedContent): string {
    if (!result.skimmed) {
      return 'File read completely (no skimming needed)';
    }

    const compressionRatio = ((result.originalSize - result.actualSize) / result.originalSize * 100).toFixed(1);
    const chunksInfo = result.chunks.map(c => c.type).join(', ');
    
    let info = `Skimmed large file: ${this.formatSize(result.originalSize)} → ${this.formatSize(result.actualSize)} (${compressionRatio}% reduction)\n`;
    info += `Chunks read: ${chunksInfo}`;
    
    if (result.patterns && result.patterns.length > 0) {
      info += `\nPattern matches: ${result.patterns.length}`;
    }

    return info;
  }

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
}

/**
 * Convenience functions for different use cases
 */
export function skimForDependencies(filePath: string): SkimmedContent {
  const skimmer = new FileSkimmer({
    maxFileSize: 512 * 1024,    // 512KB threshold for dependency files
    searchPatterns: ['import', 'require', 'export', 'from'],
    headerSize: 64 * 1024,      // Dependencies usually at top
    footerSize: 8 * 1024,       // Small footer
  });
  
  return skimmer.readFile(filePath, ['import', 'require', 'export', 'from']);
}

export function skimForFunctions(filePath: string): SkimmedContent {
  const skimmer = new FileSkimmer({
    maxFileSize: 1 * 1024 * 1024,  // 1MB threshold
    searchPatterns: ['function', 'class', 'const ', 'let ', 'var ', '=>'],
  });
  
  return skimmer.readFile(filePath, ['function', 'class', 'const ', 'let ', 'var ', '=>']);
}

export function skimForContent(filePath: string, searchTerms: string[]): SkimmedContent {
  const skimmer = new FileSkimmer();
  return skimmer.readFile(filePath, searchTerms);
}