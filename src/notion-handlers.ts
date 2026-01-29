/**
 * Notion tool handlers for Context Sync MCP Server
 */

import type { NotionIntegration } from './notion-integration.js';

export function createNotionHandlers(notionIntegration: NotionIntegration | null) {
  return {
    async handleNotionSearch(args: { query: string }) {
      if (!notionIntegration) {
        return {
          content: [{
            type: 'text',
            text: ' Notion is not configured. Run `context-sync setup` to configure Notion integration.',
          }],
          isError: true,
        };
      }

      try {
        const results = await notionIntegration.searchPages(args.query);
        
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
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: ` **Failed to search Notion**\n\nError: ${error.message}`,
          }],
          isError: true,
        };
      }
    },

    async handleNotionReadPage(args: { pageId: string }) {
      if (!notionIntegration) {
        return {
          content: [{
            type: 'text',
            text: ' Notion is not configured. Run `context-sync setup` to configure Notion integration.',
          }],
          isError: true,
        };
      }

      try {
        const page = await notionIntegration.readPage(args.pageId);
        
        let response = ` **${page.title}**\n\n`;
        response += ` ${page.url}\n\n`;
        response += `---\n\n`;
        response += page.content;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: ` **Failed to read page**\n\nError: ${error.message}\n\nMake sure:\n The page ID is correct\n The page is shared with your integration`,
          }],
          isError: true,
        };
      }
    },

    async handleNotionCreatePage(args: { title: string; content: string; parentPageId?: string }) {
      if (!notionIntegration) {
        return {
          content: [{
            type: 'text',
            text: ' Notion is not configured. Run `context-sync setup` to configure Notion integration.',
          }],
          isError: true,
        };
      }

      try {
        const page = await notionIntegration.createPage(args.title, args.content, args.parentPageId);
        
        let response = ` **Page Created Successfully!**\n\n`;
        response += ` **${page.title}**\n`;
        response += ` ${page.url}\n`;
        response += ` Page ID: ${page.id}\n\n`;
        response += ` You can now:\n`;
        response += ` Open the page in Notion\n`;
        response += ` Read it with: notion_read_page pageId:"${page.id}"\n`;
        response += ` Update it with: notion_update_page\n`;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: ` **Failed to create page**\n\nError: ${error.message}\n\nMake sure:\n A default parent page is configured, or provide parentPageId\n The parent page is shared with your integration`,
          }],
          isError: true,
        };
      }
    },

    async handleNotionUpdatePage(args: { pageId: string; content: string }) {
      if (!notionIntegration) {
        return {
          content: [{
            type: 'text',
            text: ' Notion is not configured. Run `context-sync setup` to configure Notion integration.',
          }],
          isError: true,
        };
      }

      try {
        await notionIntegration.updatePage(args.pageId, args.content);
        
        let response = ` **Page Updated Successfully!**\n\n`;
        response += ` Page ID: ${args.pageId}\n`;
        response += ` Content has been replaced with new content\n\n`;
        response += ` Read the updated page with: notion_read_page pageId:"${args.pageId}"\n`;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: ` **Failed to update page**\n\nError: ${error.message}`,
          }],
          isError: true,
        };
      }
    },

    async handleSyncDecisionToNotion(args: { decisionId: string }, storage: any) {
      if (!notionIntegration) {
        return {
          content: [{
            type: 'text',
            text: ' Notion is not configured. Run `context-sync setup` to configure Notion integration.',
          }],
          isError: true,
        };
      }

      try {
        // Get the decision from storage
        const decisions = storage.getDecisions();
        const decision = decisions.find((d: any) => d.id === args.decisionId);
        
        if (!decision) {
          return {
            content: [{
              type: 'text',
              text: ` Decision with ID "${args.decisionId}" not found.\n\nUse get_project_context to see available decisions.`,
            }],
            isError: true,
          };
        }

        const page = await notionIntegration.syncDecision(decision);
        
        let response = ` **Decision Synced to Notion!**\n\n`;
        response += ` **ADR: ${decision.description}**\n`;
        response += ` ${page.url}\n`;
        response += ` Page ID: ${page.id}\n\n`;
        response += `The decision has been formatted as an Architecture Decision Record (ADR) in Notion.\n`;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: ` **Failed to sync decision**\n\nError: ${error.message}`,
          }],
          isError: true,
        };
      }
    },

    async handleCreateProjectDashboard(args: { projectId?: string }, storage: any, currentProjectId: string | null) {
      if (!notionIntegration) {
        return {
          content: [{
            type: 'text',
            text: ' Notion is not configured. Run `context-sync setup` to configure Notion integration.',
          }],
          isError: true,
        };
      }

      try {
        const projectId = args.projectId || currentProjectId;
        
        if (!projectId) {
          return {
            content: [{
              type: 'text',
              text: ' No project specified and no current project set. Use set_workspace first or provide projectId.',
            }],
            isError: true,
          };
        }

        const project = storage.getProject(projectId);
        
        if (!project) {
          return {
            content: [{
              type: 'text',
              text: ` Project with ID "${projectId}" not found.`,
            }],
            isError: true,
          };
        }

        const page = await notionIntegration.createProjectDashboard(project);
        
        let response = ` **Project Dashboard Created!**\n\n`;
        response += ` **Project: ${project.name}**\n`;
        response += ` ${page.url}\n`;
        response += ` Page ID: ${page.id}\n\n`;
        response += `The dashboard includes:\n`;
        response += ` Project overview\n`;
        response += ` Tech stack\n`;
        response += ` Architecture notes\n`;
        response += ` Creation & update timestamps\n`;
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: ` **Failed to create dashboard**\n\nError: ${error.message}`,
          }],
          isError: true,
        };
      }
    },
  };
}


