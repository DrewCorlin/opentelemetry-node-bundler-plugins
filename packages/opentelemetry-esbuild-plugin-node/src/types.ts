/*
 * Copyright The Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { OnLoadArgs as EsbuildOnLoadArgs } from "esbuild";

import { Instrumentation } from "@opentelemetry/instrumentation";
import { ExtractedModule } from "@opentelemetry-bundler-plugins/opentelemetry-bundler-utils";

export type PluginData = {
  extractedModule: ExtractedModule;
  shouldPatchPackage: boolean;
  moduleVersion: string;
  instrumentationName: string;
};

export type OnLoadArgs = Omit<EsbuildOnLoadArgs, "pluginData"> & {
  pluginData?: PluginData;
};

export interface OpenTelemetryPluginParams {
  /** Modules to consider external and ignore from the plugin */
  externalModules?: string[];

  /**
   * Path prefixes to ignore.
   *
   * ie if you configure compilerOptions.paths in your tsconfig.json to use something like `~/` for the
   * root of your project then you could set that here to ignore modules
   */
  pathPrefixesToIgnore?: string[];

  /**
   * Instrumentations to apply
   *
   * NB: Not all config options for each instrumentation will be respected. Notably, functions will be ignored
   * as this plugin requires serializing the configs as JSON during bundling which are then read at runtime.
   *
   * This works:
   * ```typescript
   * openTelemetryPlugin({
   *   instrumentations: [
   *     new PinoInstrumentation({
   *       logKeys: {
   *         traceId: 'traceId',
   *         spanId: 'spanId',
   *         traceFlags: 'traceFlags',
   *       }
   *     })
   *   ]
   * })
   * ```
   *
   * This would not (logHook would be ignored)
   * ```typescript
   * openTelemetryPlugin({
   *   instrumentations: [
   *     new PinoInstrumentation({
   *       logHook: (span, record) => {
   *         record['resource.service.name'] = provider.resource.attributes['service.name'];
   *       }
   *     })
   *   ]
   * })
   * ```
   */
  instrumentations: Instrumentation[];
}
