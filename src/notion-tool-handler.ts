import { errorResponse, type ToolResponse } from './tool-responses.js';

type NotionHandlers = {
  handleNotionSearch(args: { query: string }): Promise<ToolResponse>;
  handleNotionReadPage(args: { pageId: string }): Promise<ToolResponse>;
};

export type NotionToolArgs = {
  action: 'search' | 'read';
  query?: string;
  pageId?: string;
};

export class NotionToolHandler {
  constructor(private readonly notionHandlers: NotionHandlers) {}

  async handle(args: NotionToolArgs): Promise<ToolResponse> {
    if (!args.action) {
      return errorResponse(' Missing required parameter: action (must be "search" or "read")');
    }

    if (args.action === 'search') {
      if (!args.query) {
        return errorResponse(' Missing required parameter: query (required for search action)');
      }
      return await this.notionHandlers.handleNotionSearch({ query: args.query });
    }

    if (args.action === 'read') {
      if (!args.pageId) {
        return errorResponse(' Missing required parameter: pageId (required for read action)');
      }
      return await this.notionHandlers.handleNotionReadPage({ pageId: args.pageId });
    }

    return errorResponse(` Unknown action: "${args.action}". Use "search" or "read".`);
  }
}
