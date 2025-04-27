import { builtinModules } from "module";
import { ExtractedModule } from "./types";

const BUILT_INS = new Set(builtinModules.flatMap((b) => [b, `node:${b}`]));
export function isBuiltIn(
  path: string,
  extractedModule: ExtractedModule
): boolean {
  return (
    BUILT_INS.has(path) ||
    BUILT_INS.has(`${extractedModule.package}/${extractedModule.path}`)
  );
}
