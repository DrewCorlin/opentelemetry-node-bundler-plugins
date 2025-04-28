import { readFile } from "fs/promises";
import path from "path";

import { PluginData } from "./types";
import {
  InstrumentationConfig,
  InstrumentationModuleDefinition,
} from "@opentelemetry/instrumentation";
import { Compiler, NormalModule } from "webpack";
import { writeFileSync } from "fs";
import os from "os";
import {
  extractPackageAndModulePath,
  getInstrumentation,
  getOtelPackageToInstrumentationConfig,
  getPackageConfig,
  isBuiltIn,
  OpenTelemetryPluginParams,
  OtelPluginInstrumentationConfigMap,
  shouldIgnoreModule,
  wrapModule,
} from "@opentelemetry-bundler-plugins/opentelemetry-bundler-utils";

const tempLoaderPath = path.join(os.tmpdir(), "otel-string-replace-loader.js");

if (!require.cache[tempLoaderPath]) {
  writeFileSync(
    tempLoaderPath,
    `
      module.exports = function (originalSource) {
        const {
          wrapModule,
          path,
          moduleVersion,
          instrumentationName,
          oTelInstrumentationClass,
          oTelInstrumentationPackage,
          oTelInstrumentationConstructorArgs
        } = this.getOptions();

        return wrapModule(originalSource, {
          path,
          moduleVersion,
          instrumentationName,
          oTelInstrumentationClass,
          oTelInstrumentationPackage,
          oTelInstrumentationConstructorArgs
        });
      };
    `
  );
}

export class OpenTelemetryWebpackPlugin {
  private pluginConfig: OpenTelemetryPluginParams;
  private otelPackageToInstrumentationConfig: Record<
    string,
    {
      oTelInstrumentationPackage: keyof OtelPluginInstrumentationConfigMap;
      oTelInstrumentationClass: string;
      configGenerator: <T extends InstrumentationConfig>(
        config?: T
      ) => string | undefined;
    }
  >;
  private instrumentationModuleDefinitions: InstrumentationModuleDefinition[];
  private moduleVersionByPackageJsonPath: Map<string, string>;

  constructor(pluginConfig: OpenTelemetryPluginParams) {
    this.pluginConfig = pluginConfig;

    const {
      otelPackageToInstrumentationConfig,
      instrumentationModuleDefinitions,
    } = getOtelPackageToInstrumentationConfig(pluginConfig.instrumentations);

    this.otelPackageToInstrumentationConfig =
      otelPackageToInstrumentationConfig;
    this.instrumentationModuleDefinitions = instrumentationModuleDefinitions;
    this.moduleVersionByPackageJsonPath = new Map();
  }

  apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap(
      "OpenTelemetryWebpackPlugin",
      (factory) => {
        factory.hooks.afterResolve.tapPromise(
          "OpenTelemetryWebpackPlugin",
          async (resolveData) => {
            const { request, context, contextInfo } = resolveData;
            if (
              shouldIgnoreModule({
                path: request,
                importer: contextInfo.issuer || "",
                externalModules: this.pluginConfig?.externalModules,
                pathPrefixesToIgnore: this.pluginConfig?.pathPrefixesToIgnore,
              })
            ) {
              return undefined;
            }

            let extractedModule;
            try {
              const result = extractPackageAndModulePath(request, context);
              extractedModule = result.extractedModule;
            } catch {
              return undefined;
            }
            if (!extractedModule || isBuiltIn(request, extractedModule)) {
              return undefined;
            }
            const moduleVersion = (await this.getModuleVersion(
              extractedModule,
              context,
              compiler
            )) as string | undefined;
            if (!moduleVersion) return undefined;

            const matchingInstrumentation = getInstrumentation({
              instrumentationModuleDefinitions:
                this.instrumentationModuleDefinitions,
              extractedModule: {
                package: extractedModule.package,
                path: this.normalizeMjsToJs(extractedModule.path),
              },
              moduleVersion,
              path: this.normalizeMjsToJs(request),
            });
            if (!matchingInstrumentation) return undefined;

            const instrumentationName = matchingInstrumentation.name;
            const config =
              this.otelPackageToInstrumentationConfig[instrumentationName];
            if (!config) return undefined;

            const packageConfig = getPackageConfig({
              pluginConfig: this.pluginConfig,
              oTelInstrumentationPackage: config.oTelInstrumentationPackage,
            });

            if (!resolveData.createData.resourceResolveData)
              resolveData.createData.resourceResolveData = {};

            const pluginData: PluginData = {
              path: path.join(
                extractedModule.package || "",
                extractedModule.path || ""
              ),
              moduleVersion,
              instrumentationName,
              oTelInstrumentationClass: config.oTelInstrumentationClass,
              oTelInstrumentationPackage: config.oTelInstrumentationPackage,
              oTelInstrumentationConstructorArgs:
                config.configGenerator(packageConfig),
            };
            resolveData.createData.resourceResolveData.__otelPluginData =
              pluginData;
          }
        );
      }
    );

    compiler.hooks.compilation.tap(
      "OpenTelemetryWebpackPlugin",
      (compilation) => {
        NormalModule.getCompilationHooks(compilation).loader.tap(
          "OpenTelemetryWebpackPlugin",
          (_, normalModule) => {
            const pluginData: PluginData =
              normalModule.resourceResolveData.__otelPluginData;

            if (pluginData) {
              // TODO: our wrapModule function assumes CJS. Document need for loader to transpile
              normalModule.loaders.unshift({
                loader: tempLoaderPath,
                options: {
                  ...pluginData,
                  path: this.normalizeMjsToJs(pluginData.path),
                  wrapModule,
                },
                ident: "OpenTelemetryWebpackPlugin",
                type: "javascript/auto",
              });
            }
          }
        );
      }
    );
  }

  private getModuleVersion(
    extractedModule: {
      package: string;
      path: string;
    },
    resolveDir: string,
    compiler: Compiler
  ) {
    const cacheKey = `${extractedModule.package}/package.json`;
    if (this.moduleVersionByPackageJsonPath.has(cacheKey)) {
      return this.moduleVersionByPackageJsonPath.get(cacheKey);
    }

    const resolver = compiler.resolverFactory.get("normal");
    const context = {};
    const request = `${extractedModule.package}/package.json`;

    return new Promise((resolve) => {
      resolver.resolve(
        {},
        resolveDir,
        request,
        context,
        async (err, resolvedPath) => {
          if (err || !resolvedPath) return resolve(null);
          const contents = await readFile(resolvedPath, "utf-8");
          const version = JSON.parse(contents).version;
          this.moduleVersionByPackageJsonPath.set(cacheKey, version);
          resolve(version);
        }
      );
    });
  }

  private normalizeMjsToJs(filename: string) {
    return filename.replace(/(.mjs)$/, ".js");
  }
}
