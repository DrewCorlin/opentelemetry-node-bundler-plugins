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

import { OnLoadArgs, PluginData } from "./types";
import { Plugin, PluginBuild } from "esbuild";
import { dirname, join } from "path";

import { readFile } from "fs/promises";

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

export function openTelemetryPlugin(
  pluginConfig: OpenTelemetryPluginParams
): Plugin {
  const {
    otelPackageToInstrumentationConfig,
    instrumentationModuleDefinitions,
  } = getOtelPackageToInstrumentationConfig(pluginConfig.instrumentations);

  return {
    name: "open-telemetry",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (
          args.namespace !== "file" ||
          shouldIgnoreModule({
            path: args.path,
            importer: args.importer,
            externalModules: pluginConfig.externalModules,
            pathPrefixesToIgnore: pluginConfig.pathPrefixesToIgnore,
          })
        ) {
          return;
        }

        let path;
        let extractedModule;

        try {
          const result = extractPackageAndModulePath(
            args.path,
            args.resolveDir
          );
          path = result.path;
          extractedModule = result.extractedModule;
        } catch {
          // Some libraries like `mongodb` require optional dependencies, which may not be present and their absence doesn't break the code
          // Currently esbuild doesn't provide any better way to handle this in plugins: https://github.com/evanw/esbuild/issues/1127
        }

        // If it's a local import, don't patch it
        if (!extractedModule) return;

        // We'll rely on the OTel auto-instrumentation at runtime to patch builtin modules
        if (isBuiltIn(args.path, extractedModule)) return;

        const moduleVersion = await getModuleVersion({
          extractedModule,
          resolveDir: args.resolveDir,
          build,
        });
        if (!moduleVersion) return;

        // See if we have an instrumentation registered for this package
        const matchingInstrumentation = getInstrumentation({
          instrumentationModuleDefinitions,
          extractedModule,
          moduleVersion,
          path: args.path,
        });
        if (!matchingInstrumentation) return;

        const pluginData: PluginData = {
          extractedModule,
          moduleVersion,
          shouldPatchPackage: true,
          instrumentationName: matchingInstrumentation.name,
        };

        return { path, pluginData };
      });

      build.onLoad(
        { filter: /.*/ },
        async ({ path, pluginData }: OnLoadArgs) => {
          // Ignore any packages that don't have an instrumentation registered for them
          if (!pluginData?.shouldPatchPackage) return;

          const contents = await readFile(path);

          const config =
            otelPackageToInstrumentationConfig[pluginData.instrumentationName];
          if (!config) return;

          const packageConfig = getPackageConfig({
            pluginConfig,
            oTelInstrumentationPackage: config.oTelInstrumentationPackage,
          });
          const extractedModule = pluginData.extractedModule;

          return {
            contents: wrapModule(contents.toString(), {
              path: join(
                extractedModule.package || "",
                extractedModule.path || ""
              ),
              moduleVersion: pluginData.moduleVersion,
              instrumentationName: pluginData.instrumentationName,
              oTelInstrumentationClass: config.oTelInstrumentationClass,
              oTelInstrumentationPackage: config.oTelInstrumentationPackage,
              oTelInstrumentationConstructorArgs:
                config.configGenerator(packageConfig),
            }),
            resolveDir: dirname(path),
          };
        }
      );
    },
  };
}

const moduleVersionByPackageJsonPath = new Map<string, string>();

async function getModuleVersion({
  extractedModule,
  resolveDir,
  build,
}: {
  extractedModule: ExtractedModule;
  resolveDir: string;
  build: PluginBuild;
}): Promise<string | undefined> {
  const path = `${extractedModule.package}/package.json`;
  const contents = moduleVersionByPackageJsonPath.get(path);
  if (contents) return contents;

  const { path: packageJsonPath } = await build.resolve(path, {
    resolveDir,
    kind: "require-resolve",
  });
  if (!packageJsonPath) return;

  const packageJsonContents = await readFile(packageJsonPath);
  const moduleVersion = JSON.parse(packageJsonContents.toString()).version;
  moduleVersionByPackageJsonPath.set(path, moduleVersion);
  return moduleVersion;
}
