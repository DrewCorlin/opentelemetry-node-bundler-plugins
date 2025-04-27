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

import {
  EsbuildInstrumentationConfigMap,
  OnLoadArgs,
  OpenTelemetryPluginParams,
  PluginData,
} from "./types";
import { Plugin, PluginBuild } from "esbuild";
import { dirname, join } from "path";

import { InstrumentationModuleDefinition } from "@opentelemetry/instrumentation";

import { readFile } from "fs/promises";
import { satisfies } from "semver";

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { getOtelPackageToInstrumentationConfig } from "./config";
import {
  ExtractedModule,
  extractPackageAndModulePath,
  isBuiltIn,
  shouldIgnoreModule,
  wrapModule,
} from "@opentelemetry-bundler-plugins/opentelemetry-bundler-utils";

function validateConfig(pluginConfig?: OpenTelemetryPluginParams) {
  if (!pluginConfig) return;
  if (pluginConfig.instrumentationConfig && pluginConfig.instrumentations) {
    throw new Error(
      "OpenTelemetryPluginParams and instrumentations must not be used together"
    );
  }
}

export function openTelemetryPlugin(
  pluginConfig?: OpenTelemetryPluginParams
): Plugin {
  validateConfig(pluginConfig);

  const {
    otelPackageToInstrumentationConfig,
    instrumentationModuleDefinitions,
  } = getOtelPackageToInstrumentationConfig(
    pluginConfig?.instrumentations ?? getNodeAutoInstrumentations()
  );

  return {
    name: "open-telemetry",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (
          args.namespace !== "file" ||
          shouldIgnoreModule({
            path: args.path,
            importer: args.importer,
            externalModules: pluginConfig?.externalModules,
            pathPrefixesToIgnore: pluginConfig?.pathPrefixesToIgnore,
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

function getPackageConfig({
  pluginConfig,
  oTelInstrumentationPackage,
}: {
  pluginConfig?: OpenTelemetryPluginParams;
  oTelInstrumentationPackage: keyof EsbuildInstrumentationConfigMap;
}) {
  if (!pluginConfig) return;
  if (pluginConfig.instrumentations) {
    const matchingPlugin = pluginConfig.instrumentations.find(
      (i) => i.instrumentationName === oTelInstrumentationPackage
    );
    if (!matchingPlugin) {
      throw new Error(
        `Instrumentation ${oTelInstrumentationPackage} was found but does not exist in list of instrumentations`
      );
    }
    return matchingPlugin.getConfig();
  }
  return pluginConfig.instrumentationConfig?.[oTelInstrumentationPackage];
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
}) {
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

function getInstrumentation({
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
      instrumentationModuleDefinition.supportedVersions.some(
        (supportedVersion) => satisfies(moduleVersion, supportedVersion)
      )
    ) {
      return instrumentationModuleDefinition;
    }

    if (
      instrumentationModuleDefinition.files.some((file) => {
        if (file.name !== path && file.name !== fullModulePath) return false;
        return file.supportedVersions.some((supportedVersion) =>
          satisfies(moduleVersion, supportedVersion)
        );
      })
    ) {
      return instrumentationModuleDefinition;
    }
  }
  return null;
}
