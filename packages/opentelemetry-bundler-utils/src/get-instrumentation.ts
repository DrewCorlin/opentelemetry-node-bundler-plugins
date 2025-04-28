import { InstrumentationModuleDefinition } from "@opentelemetry/instrumentation";

import { satisfies } from "semver";
import { ExtractedModule } from "./types";

export function getInstrumentation({
  instrumentationModuleDefinitions,
  extractedModule,
  path,
  moduleVersion,
}: {
  instrumentationModuleDefinitions: InstrumentationModuleDefinition[];
  extractedModule: ExtractedModule;
  path: string;
  moduleVersion: string;
}): InstrumentationModuleDefinition | null {
  for (const instrumentationModuleDefinition of instrumentationModuleDefinitions) {
    const fullModulePath = `${extractedModule.package}/${extractedModule.path}`;
    const nameMatches =
      instrumentationModuleDefinition.name === path ||
      instrumentationModuleDefinition.name === fullModulePath;

    if (!nameMatches) {
      const fileMatch = instrumentationModuleDefinition.files.find((file) => {
        return file.name === path || file.name === fullModulePath;
      });
      if (!fileMatch) continue;
    }

    if (
      instrumentationModuleDefinition.supportedVersions.some((ver) =>
        satisfies(moduleVersion, ver)
      )
    ) {
      return instrumentationModuleDefinition;
    }

    if (
      instrumentationModuleDefinition.files.some(
        (f) =>
          (f.name === path || f.name === fullModulePath) &&
          f.supportedVersions.some((ver) => satisfies(moduleVersion, ver))
      )
    ) {
      return instrumentationModuleDefinition;
    }
  }

  return null;
}
