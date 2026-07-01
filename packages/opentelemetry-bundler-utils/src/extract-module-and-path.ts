import { createRequire } from "node:module";
import { NODE_MODULES } from "./common.js";
import type { ExtractedModule } from "./types.js";

const require = createRequire(import.meta.url);

/**
 * For a given full path to a module,
 *   return the package name it belongs to and the local path to the module
 *   input: '/foo/node_modules/@co/stuff/foo/bar/baz.js'
 *   output: { package: '@co/stuff', path: 'foo/bar/baz.js' }
 */
export function extractPackageAndModulePath(
  originalPath: string,
  resolveDir: string
): { path: string; extractedModule: ExtractedModule | null } {
  // @see https://github.com/nodejs/node/issues/47000
  const path = require.resolve(
    originalPath === "." ? "./" : originalPath === ".." ? "../" : originalPath,
    { paths: [resolveDir] }
  );

  const nodeModulesIndex = path.lastIndexOf(NODE_MODULES);
  if (nodeModulesIndex < 0) return { path, extractedModule: null };

  const subPath = path.substring(nodeModulesIndex + NODE_MODULES.length);
  const firstSlashIndex = subPath.indexOf("/");

  if (!subPath.startsWith("@")) {
    return {
      path,
      extractedModule: {
        package: subPath.substring(0, firstSlashIndex),
        path: subPath.substring(firstSlashIndex + 1),
      },
    };
  }

  const secondSlash = subPath.substring(firstSlashIndex + 1).indexOf("/");
  return {
    path,
    extractedModule: {
      package: subPath.substring(0, firstSlashIndex + secondSlash + 1),
      path: subPath.substring(firstSlashIndex + secondSlash + 2),
    },
  };
}
