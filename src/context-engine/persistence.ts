import { AutoContextExtractor, ExtractedContext } from './auto-extractor.js';
import { Storage } from '../storage.js';

/**
 * Wire extractor events to persistent Storage.
 * This is a conservative PoC mapping:
 * - 'decision' -> Storage.addDecision
 * - 'documentation' -> Storage.addConversation (tool: 'extractor')
 * - 'code_change' -> Storage.addConversation (tool: 'extractor')
 */
export function wirePersistence(extractor: AutoContextExtractor, storage: Storage, projectPath?: string) {
  // Resolve or create project
  const resolvedPath = projectPath || process.cwd();
  let project = storage.findProjectByPath(resolvedPath);
  if (!project) {
    const name = pathSepLast(resolvedPath) || 'workspace';
    project = storage.createProject(name, resolvedPath);
  }

  extractor.on('context-item-extracted', (item: ExtractedContext) => {
    try {
      if (item.type === 'decision') {
        storage.addDecision({
          projectId: project!.id,
          type: 'other',
          description: item.content.slice(0, 4000),
          reasoning: item.content,
        });
      } else if (item.type === 'documentation' || item.type === 'code_change') {
        storage.addConversation({
          projectId: project!.id,
          tool: 'other',
          role: 'assistant',
          content: item.content,
          metadata: item.metadata as any,
        });
      } else {
        // fallback: store as conversation
        storage.addConversation({
          projectId: project!.id,
          tool: 'other',
          role: 'assistant',
          content: item.content,
          metadata: item.metadata as any,
        });
      }
    } catch (err) {
      extractor.emit('persistence-error', { error: err, item });
    }
  });

  // Also persist batch context-extracted events (optional)
  extractor.on('context-extracted', (payload: any) => {
    // payload.contexts may be an array - handled by item handler above
  });
}

function pathSepLast(p: string) {
  if (!p) return p;
  const parts = p.split(/[/\\]+/);
  return parts[parts.length - 1] || p;
}

export default wirePersistence;
