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

import type { OnLoadArgs as EsbuildOnLoadArgs } from 'esbuild';
import type { InstrumentationConfigMap } from '@opentelemetry/auto-instrumentations-node';
import { Instrumentation } from '@opentelemetry/instrumentation';

export interface ExtractedModule {
  package: string;
  path: string;
}

export type PluginData = {
  extractedModule: ExtractedModule;
  shouldPatchPackage: boolean;
  moduleVersion: string;
  instrumentationName: string;
};

export type OnLoadArgs = Omit<EsbuildOnLoadArgs, 'pluginData'> & {
  pluginData?: PluginData;
};

export interface ModuleParams {
  path?: string;
  oTelInstrumentationPackage: string;
  oTelInstrumentationClass: string;
  oTelInstrumentationConstructorArgs?: string;
  instrumentationName?: string;
  moduleVersion: string;
}

type _RemoveFunctions<T> = {
  [P in keyof T as T[P] extends (...args: unknown[]) => unknown
    ? never
    : P]: T[P];
};

// _RemoveFunctions does not work on optional fields, so first make the type required then apply Partial to the result
export type RemoveFunctions<T> = Partial<_RemoveFunctions<Required<T>>>;

type BuiltinPackages =
  | '@opentelemetry/instrumentation-dns'
  | '@opentelemetry/instrumentation-fs'
  | '@opentelemetry/instrumentation-http';

type NonBuiltinInstrumentationConfigMap = Omit<
  InstrumentationConfigMap,
  BuiltinPackages
>;

export type EsbuildInstrumentationConfigMap = {
  [K in keyof NonBuiltinInstrumentationConfigMap]: RemoveFunctions<
    NonBuiltinInstrumentationConfigMap[K]
  >;
};

export interface OpenTelemetryPluginParams {
  /**
   * Allow configuring instrumentations loaded from getNodeAutoInstrumentations (from @opentelemetry/auto-instrumentations-node).
   *
   * @deprecated Use `instrumentations` instead and pass in already configured instrumentations
   */
  instrumentationConfig?: EsbuildInstrumentationConfigMap;

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
   * Defaults to `getNodeAutoInstrumentations()` from `@opentelemetry/auto-instrumentations-node`.
   * NB: getNodeAutoInstrumentations() can change what it returns (and what is enabled by default) version to version
   * so as this plugin updates dependencies that may change, if you are not manually configuring instrumentations.
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
  instrumentations?: Instrumentation[];
}
