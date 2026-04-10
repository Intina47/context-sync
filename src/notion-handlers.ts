/**
 * Notion tool handlers for Context Sync MCP Server
 */

import type { NotionIntegration } from './notion-integration.js';
import { errorResponse, textResponse, type ToolResponse } from './tool-responses.js';

function getNotionIntegration(notionIntegration: NotionIntegration | null): NotionIntegration | ToolResponse {
  if (notionIntegration) {
    return notionIntegration;
  }

  return errorResponse(' Notion is not configured. Run `context-sync setup` to configure Notion integration.');
}

export function createNotionHandlers(notionIntegration: NotionIntegration | null) {
  return {
    async handleNotionSearch(args: { query: string }): Promise<ToolResponse> {
      const integration = getNotionIntegration(notionIntegration);
      if ('content' in integration) {
        return integration;
      }

      try {
        const results = await integration.searchPages(args.query);

        let response = ` **Notion Search Results for "${args.query}"**\n\n`;
        response += `Found ${results.pages.length} page(s)\n\n`;

        results.pages.forEach((page, i) => {
          response += `${i + 1}. **${page.title}**\n`;
          response += `   ID: ${page.id}\n`;
          response += `   URL: ${page.url}\n`;
          response += `   Last edited: ${new Date(page.lastEditedTime).toLocaleString()}\n\n`;
        });

        if (results.pages.length === 0) {
          response += ` **Tips:**\n`;
          response += ` Make sure pages are shared with your Notion integration\n`;
          response += ` Try a different search query\n`;
          response += ` Check your Notion workspace permissions\n`;
        }

        return textResponse(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return textResponse(` **Failed to search Notion**\n\nError: ${message}`, true);
      }
    },

    async handleNotionReadPage(args: { pageId: string }): Promise<ToolResponse> {
      const integration = getNotionIntegration(notionIntegration);
      if ('content' in integration) {
        return integration;
      }

      try {
        const page = await integration.readPage(args.pageId);

        let response = ` **${page.title}**\n\n`;
        response += ` ${page.url}\n\n`;
        response += `---\n\n`;
        response += page.content;

        return textResponse(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return textResponse(
          ` **Failed to read page**\n\nError: ${message}\n\nMake sure:\n The page ID is correct\n The page is shared with your integration`,
          true
        );
      }
    },
  };
}
