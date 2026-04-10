import * as path from 'path';

function normalizeRoot(rootPath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  return resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;
}

export function resolveWorkspacePath(rootPath: string, relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new Error('Path must be a non-empty string');
  }

  const trimmedPath = relativePath.trim();
  if (path.isAbsolute(trimmedPath)) {
    throw new Error('Path must be relative to the workspace root');
  }

  const resolvedRoot = normalizeRoot(rootPath);
  const resolvedTarget = path.resolve(rootPath, trimmedPath);
  const normalizedTarget = path.normalize(resolvedTarget);

  if (!normalizedTarget.startsWith(resolvedRoot)) {
    throw new Error('Path must stay within the workspace root');
  }

  return normalizedTarget;
}
