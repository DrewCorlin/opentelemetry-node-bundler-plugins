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

import { Plugin } from "rollup";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import {
  ExtractedModule,
  extractPackageAndModulePath,
  getInstrumentation,
  getOtelPackageToInstrumentationConfig,
  getPackageConfig,
  isBuiltIn,
  OpenTelemetryPluginParams,
  shouldIgnoreModule,
  wrapModule,
} from "opentelemetry-node-bundler-plugin-utils";
import { PluginData } from "./types";

const moduleVersionByPackageJsonPath = new Map<string, string>();

async function getModuleVersion({
  extractedModule,
  resolveDir,
}: {
  extractedModule: ExtractedModule;
  resolveDir: string;
}): Promise<string | undefined> {
  const path = `${extractedModule.package}/package.json`;
  const contents = moduleVersionByPackageJsonPath.get(path);
  if (contents) return contents;

  try {
    const packageJsonPath = require.resolve(path, { paths: [resolveDir] });
    const packageJsonContents = await readFile(packageJsonPath);
    const moduleVersion = JSON.parse(packageJsonContents.toString()).version;
    moduleVersionByPackageJsonPath.set(path, moduleVersion);
    return moduleVersion;
  } catch {
    return undefined;
  }
}

export function openTelemetryPlugin(
  pluginConfig: OpenTelemetryPluginParams
): Plugin {
  const {
    otelPackageToInstrumentationConfig,
    instrumentationModuleDefinitions,
  } = getOtelPackageToInstrumentationConfig(pluginConfig.instrumentations);

  const moduleInfoCache = new Map<string, PluginData>();

  return {
    name: "open-telemetry",
    resolveId(importee, importer) {
      if (
        !importer ||
        shouldIgnoreModule({
          path: importee,
          importer,
          externalModules: pluginConfig.externalModules,
          pathPrefixesToIgnore: pluginConfig.pathPrefixesToIgnore,
        })
      ) {
        return null;
      }

      let path;
      let extractedModule;

      try {
        const result = extractPackageAndModulePath(importee, dirname(importer));
        path = result.path;
        extractedModule = result.extractedModule;
      } catch {
        // Some libraries like `mongodb` require optional dependencies, which may not be present
        return null;
      }

      // If it's a local import, don't patch it
      if (!extractedModule) return null;

      // We'll rely on the OTel auto-instrumentation at runtime to patch builtin modules
      if (isBuiltIn(importee, extractedModule)) return null;

      // Store the module info for later use in transform
      const meta: PluginData = {
        extractedModule,
        shouldPatchPackage: true,
        path: importee,
      };

      moduleInfoCache.set(path, meta);
      return path;
    },

    async transform(code, id) {
      const meta = moduleInfoCache.get(id);
      if (!meta?.shouldPatchPackage) return null;

      // Process module version and instrumentation if not already done
      if (!meta.moduleVersion) {
        const moduleVersion = await getModuleVersion({
          extractedModule: meta.extractedModule,
          resolveDir: dirname(id),
        });
        if (!moduleVersion) return null;

        const matchingInstrumentation = getInstrumentation({
          instrumentationModuleDefinitions,
          extractedModule: meta.extractedModule,
          moduleVersion,
          path: meta.path,
        });
        if (!matchingInstrumentation) return null;

        meta.moduleVersion = moduleVersion;
        meta.instrumentationName = matchingInstrumentation.name;
      }

      const config = meta.instrumentationName
        ? otelPackageToInstrumentationConfig[meta.instrumentationName]
        : undefined;
      if (!config) return null;

      const packageConfig = getPackageConfig({
        pluginConfig,
        oTelInstrumentationPackage: config.oTelInstrumentationPackage,
      });

      const transformedCode = wrapModule(code, {
        path: join(meta.extractedModule.package, meta.extractedModule.path),
        moduleVersion: meta.moduleVersion!,
        instrumentationName: meta.instrumentationName,
        oTelInstrumentationClass: config.oTelInstrumentationClass,
        oTelInstrumentationPackage: config.oTelInstrumentationPackage,
        oTelInstrumentationConstructorArgs:
          config.configGenerator(packageConfig),
      });

      return { code: transformedCode };
    },
  };
}
