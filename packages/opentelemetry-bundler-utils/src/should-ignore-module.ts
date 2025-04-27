import { NODE_MODULES } from "./common";

export function shouldIgnoreModule({
  path,
  importer,
  externalModules,
  pathPrefixesToIgnore,
}: {
  path: string;
  importer: string;
  externalModules?: string[];
  pathPrefixesToIgnore?: string[];
}): boolean {
  // If it's a local import from our code, ignore it
  if (!importer.includes(NODE_MODULES) && path.startsWith(".")) return true;
  // If it starts with a prefix to ignore, ignore it
  if (pathPrefixesToIgnore?.some((prefix) => path.startsWith(prefix))) {
    return true;
  }
  // If it's marked as external, ignore it
  if (externalModules?.includes(path)) return true;

  return false;
}
