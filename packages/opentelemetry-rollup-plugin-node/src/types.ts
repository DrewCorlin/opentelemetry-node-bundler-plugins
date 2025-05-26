import { ExtractedModule } from "opentelemetry-node-bundler-plugin-utils";

export type PluginData = {
  extractedModule: ExtractedModule;
  shouldPatchPackage: boolean;
  moduleVersion?: string;
  instrumentationName?: string;
  path: string;
};
