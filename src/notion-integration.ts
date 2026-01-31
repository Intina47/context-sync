/**
 * Notion Integration for Context Sync
 * Provides direct Notion API integration for reading and writing documentation
 */

import { Client } from '@notionhq/client';
import type { Decision, ProjectContext } from './types.js';

export interface NotionConfig {
  token: string;
  defaultParentPageId?: string; // Optional: where to create new pages
}

export interface NotionPageResult {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
}

export interface NotionSearchResult {
  pages: NotionPageResult[];
  databases: any[];
  totalCount: number;
}

/**
 * Notion API Integration
 * Handles all Notion operations for Context Sync
 */
export class NotionIntegration {
  private notion: Client;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = config;
    this.notion = new Client({ auth: config.token });
  }

  /**
   * Test the Notion connection
   * Returns current bot/user information
   */
  async testConnection(): Promise<{ name: string; type: string; workspace: string }> {
    try {
      const response = await this.notion.users.me({});
      
      // Get bot info
      const botInfo = response as any;
      
      return {
        name: botInfo.name || botInfo.bot?.owner?.user?.name || 'Unknown',
        type: botInfo.type || 'bot',
        workspace: botInfo.bot?.workspace_name || 'Connected'
      };
    } catch (error: any) {
      throw new Error(`Failed to connect to Notion: ${error.message}`);
    }
  }

  /**
   * Search Notion workspace for pages
   */
  async searchPages(query: string): Promise<NotionSearchResult> {
    try {
      const response = await this.notion.search({
        query,
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' }
      });

      const pages = response.results
        .filter((result: any) => result.object === 'page')
        .map((page: any) => {
          const pageData = page as any;
          const title = this.extractPageTitle(pageData);
          
          return {
            id: pageData.id,
            title,
            url: pageData.url,
            lastEditedTime: pageData.last_edited_time
          };
        });

      return {
        pages,
        databases: [], // Databases would need separate search query
        totalCount: response.results.length
      };
    } catch (error: any) {
      throw new Error(`Failed to search Notion: ${error.message}`);
    }
  }

  /**
   * Read page content from Notion
   */
  async readPage(pageId: string): Promise<{ title: string; content: string; url: string }> {
    try {
      // Validate page ID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(pageId)) {
        throw new Error(
          `Invalid page ID: "${pageId}". ` +
          `Page IDs must be UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).`
        );
      }

      const page = await this.notion.pages.retrieve({ page_id: pageId }) as any;
      const blocks = await this.notion.blocks.children.list({ block_id: pageId });

      const title = this.extractPageTitle(page);
      const content = this.extractBlocksText(blocks.results);

      return {
        title,
        content,
        url: page.url
      };
    } catch (error: any) {
      throw new Error(`Failed to read page: ${error.message}`);
    }
  }

  /**
   * Create a new documentation page in Notion
   * Automatically handles content chunking if it exceeds Notion's 100-block limit
   */
  async createPage(title: string, content: string, parentPageId?: string): Promise<NotionPageResult> {
    try {
      const parent = parentPageId || this.config.defaultParentPageId;
      
      if (!parent) {
        throw new Error('No parent page specified. Please configure a default parent page or provide one.');
      }

      // Validate UUID format (Notion page IDs are UUIDs with dashes)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(parent)) {
        throw new Error(
          `Invalid parent page ID: "${parent}". ` +
          `Page IDs must be UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). ` +
          `Run 'context-sync setup' to configure a valid parent page.`
        );
      }

      const allBlocks = this.contentToBlocks(content);
      
      // Notion API limit: 100 blocks per request
      const MAX_BLOCKS = 100;
      
      if (allBlocks.length > MAX_BLOCKS) {
        // Create page with first 100 blocks
        const initialBlocks = allBlocks.slice(0, MAX_BLOCKS);
        
        const response = await this.notion.pages.create({
          parent: { page_id: parent },
          properties: {
            title: {
              title: [{ text: { content: title } }]
            }
          },
          children: initialBlocks
        }) as any;

        // Append remaining blocks in chunks of 100
        const remainingBlocks = allBlocks.slice(MAX_BLOCKS);
        for (let i = 0; i < remainingBlocks.length; i += MAX_BLOCKS) {
          const chunk = remainingBlocks.slice(i, i + MAX_BLOCKS);
          await this.notion.blocks.children.append({
            block_id: response.id,
            children: chunk
          });
        }

        return {
          id: response.id,
          title,
          url: response.url,
          lastEditedTime: response.last_edited_time
        };
      } else {
        // Content fits in one request
        const response = await this.notion.pages.create({
          parent: { page_id: parent },
          properties: {
            title: {
              title: [{ text: { content: title } }]
            }
          },
          children: allBlocks
        }) as any;

        return {
          id: response.id,
          title,
          url: response.url,
          lastEditedTime: response.last_edited_time
        };
      }
    } catch (error: any) {
      throw new Error(`Failed to create page: ${error.message}`);
    }
  }

  /**
   * Update existing page content
   * Automatically handles content chunking if it exceeds Notion's 100-block limit
   */
  async updatePage(pageId: string, content: string): Promise<void> {
    try {
      // Validate page ID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(pageId)) {
        throw new Error(
          `Invalid page ID: "${pageId}". ` +
          `Page IDs must be UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).`
        );
      }

      // Archive existing blocks
      const existingBlocks = await this.notion.blocks.children.list({ block_id: pageId });
      for (const block of existingBlocks.results) {
        await this.notion.blocks.delete({ block_id: (block as any).id });
      }

      // Add new content in chunks if needed
      const allBlocks = this.contentToBlocks(content);
      const MAX_BLOCKS = 100;
      
      for (let i = 0; i < allBlocks.length; i += MAX_BLOCKS) {
        const chunk = allBlocks.slice(i, i + MAX_BLOCKS);
        await this.notion.blocks.children.append({
          block_id: pageId,
          children: chunk
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to update page: ${error.message}`);
    }
  }

  /**
   * Sync a Context Sync decision to Notion as an ADR (Architecture Decision Record)
   */
  async syncDecision(decision: Decision): Promise<NotionPageResult> {
    const title = `ADR: ${decision.description}`;
    const content = this.formatDecisionAsADR(decision);
    
    return await this.createPage(title, content);
  }

  /**
   * Create a project dashboard page in Notion
   */
  async createProjectDashboard(project: ProjectContext): Promise<NotionPageResult> {
    const title = `Project: ${project.name}`;
    const content = this.formatProjectDashboard(project);
    
    return await this.createPage(title, content);
  }

  /**
   * List all accessible pages (useful for configuration)
   */
  async listAccessiblePages(): Promise<NotionPageResult[]> {
    try {
      const response = await this.notion.search({
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 20
      });

      return response.results.map((page: any) => {
        const pageData = page as any;
        return {
          id: pageData.id,
          title: this.extractPageTitle(pageData),
          url: pageData.url,
          lastEditedTime: pageData.last_edited_time
        };
      });
    } catch (error: any) {
      throw new Error(`Failed to list pages: ${error.message}`);
    }
  }

  // ===== Helper Methods =====

  private extractPageTitle(page: any): string {
    try {
      const properties = page.properties;
      
      // Try different title property names
      const titleProp = properties.title || properties.Title || properties.Name || properties.name;
      
      if (titleProp?.title) {
        return titleProp.title.map((t: any) => t.plain_text).join('') || 'Untitled';
      }
      
      return 'Untitled';
    } catch {
      return 'Untitled';
    }
  }

  private extractBlocksText(blocks: any[]): string {
    return blocks
      .map(block => {
        const type = block.type;
        const content = block[type];
        
        if (content?.rich_text) {
          return content.rich_text.map((t: any) => t.plain_text).join('');
        }
        
        return '';
      })
      .filter(text => text.length > 0)
      .join('\n\n');
  }

  private contentToBlocks(content: string): any[] {
    const lines = content.split('\n');
    const blocks: any[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Heading 1 (# Title)
      if (trimmed.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: trimmed.substring(2).trim() } }]
          }
        });
      }
      // Heading 2 (## Title)
      else if (trimmed.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: trimmed.substring(3).trim() } }]
          }
        });
      }
      // Heading 3 (### Title)
      else if (trimmed.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: trimmed.substring(4).trim() } }]
          }
        });
      }
      // Bulleted list (- Item or * Item)
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: this.parseRichText(trimmed.substring(2).trim())
          }
        });
      }
      // Numbered list (1. Item)
      else if (/^\d+\.\s/.test(trimmed)) {
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: this.parseRichText(trimmed.replace(/^\d+\.\s/, ''))
          }
        });
      }
      // Divider (---)
      else if (trimmed === '---' || trimmed === '***') {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
      }
      // Quote (> Text)
      else if (trimmed.startsWith('> ')) {
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: this.parseRichText(trimmed.substring(2).trim())
          }
        });
      }
      // Code block (```language ... ```)
      else if (trimmed.startsWith('```')) {
        const language = trimmed.substring(3).trim() || 'plain text';
        let codeContent = '';
        i++; // Move to next line
        
        // Collect code lines until closing ```
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeContent += lines[i] + '\n';
          i++;
        }
        
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ text: { content: codeContent.trim() } }],
            language: language
          }
        });
      }
      // Regular paragraph
      else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: this.parseRichText(trimmed)
          }
        });
      }
    }
    
    return blocks;
  }

  /**
   * Parse text with markdown formatting (bold, italic, code, links)
   */
  private parseRichText(text: string): any[] {
    const richText: any[] = [];
    let currentText = text;
    let lastIndex = 0;
    
    // Regex patterns for markdown
    const patterns = [
      { regex: /\*\*([^*]+)\*\*/g, annotation: { bold: true } },      // **bold**
      { regex: /\*([^*]+)\*/g, annotation: { italic: true } },         // *italic*
      { regex: /__([^_]+)__/g, annotation: { bold: true } },           // __bold__
      { regex: /_([^_]+)_/g, annotation: { italic: true } },           // _italic_
      { regex: /`([^`]+)`/g, annotation: { code: true } },             // `code`
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, annotation: null }          // [link](url)
    ];
    
    // Simple approach: if text has any markdown, parse it; otherwise return plain text
    const hasMarkdown = patterns.some(p => p.regex.test(text));
    
    if (!hasMarkdown) {
      return [{ text: { content: text } }];
    }
    
    // For now, handle bold, italic, and code inline
    let processedText = text;
    const segments: Array<{ text: string; annotations?: any; link?: string }> = [];
    
    // Handle bold text
    processedText = text.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
      segments.push({ text: content, annotations: { bold: true } });
      return `{{SEGMENT_${segments.length - 1}}}`;
    });
    
    // Handle code
    processedText = processedText.replace(/`([^`]+)`/g, (match, content) => {
      segments.push({ text: content, annotations: { code: true } });
      return `{{SEGMENT_${segments.length - 1}}}`;
    });
    
    // Split and rebuild
    const parts = processedText.split(/({{SEGMENT_\d+}})/g);
    const result: any[] = [];
    
    for (const part of parts) {
      const segmentMatch = part.match(/{{SEGMENT_(\d+)}}/);
      if (segmentMatch) {
        const segment = segments[parseInt(segmentMatch[1])];
        result.push({
          text: { content: segment.text },
          annotations: segment.annotations || {}
        });
      } else if (part.trim()) {
        result.push({ text: { content: part } });
      }
    }
    
    return result.length > 0 ? result : [{ text: { content: text } }];
  }

  private formatDecisionAsADR(decision: Decision): string {
    return `
# Architecture Decision Record

## Status
Accepted

## Type
${decision.type}

## Context
${decision.description}

## Decision
${decision.reasoning || 'No additional reasoning provided.'}

## Consequences
This decision was made on ${decision.timestamp.toISOString()}.

---
*Generated by Context Sync*
    `.trim();
  }

  private formatProjectDashboard(project: ProjectContext): string {
    return `
# ${project.name}

## Overview
Project created on ${project.createdAt.toISOString()}
Last updated: ${project.updatedAt.toISOString()}

${project.path ? `**Path:** \`${project.path}\`` : ''}

## Tech Stack
${project.techStack.map(tech => `- ${tech}`).join('\n')}

${project.architecture ? `\n## Architecture\n${project.architecture}` : ''}

---
*Generated by Context Sync*
    `.trim();
  }
}

