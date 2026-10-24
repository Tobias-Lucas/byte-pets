// Use node:path relative semantics instead of comparing absolute paths with
// a hard-coded '/' separator. Works with Windows drive paths and POSIX paths.
import path from 'node:path';

/** Returns true only when candidate is rootDir or lives inside it. */
export function isPathInside(rootDir, candidate, ops = path) {
  const rel = ops.relative(rootDir, candidate);
  return rel !== '..' && !rel.startsWith('..' + ops.sep) && !ops.isAbsolute(rel);
}
