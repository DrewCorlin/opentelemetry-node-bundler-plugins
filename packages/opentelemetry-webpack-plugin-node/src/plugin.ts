import { readFile } from "fs/promises";
import path from "path";
import { builtinModules } from "module";
import { satisfies } from "semver";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { getOtelPackageToInstrumentationConfig } from "./config";
import { wrapModule } from "./common";
import {
  EsbuildInstrumentationConfigMap,
  ExtractedModule,
  OpenTelemetryPluginParams,
} from "./types";
import { InstrumentationModuleDefinition } from "@opentelemetry/instrumentation";
import { Compiler, NormalModule } from "webpack";
import { writeFileSync } from "fs";
import os from "os";

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

const NODE_MODULES = "node_modules/";
const BUILT_INS = new Set(builtinModules.flatMap((b) => [b, `node:${b}`]));

export class OpenTelemetryWebpackPlugin {
  private pluginConfig?: OpenTelemetryPluginParams;
  // TODO: Commonize type with esbuild's src/config/main.ts otelPackageToInstrumentationConfig
  private otelPackageToInstrumentationConfig: Record<
    string,
    {
      oTelInstrumentationPackage: keyof EsbuildInstrumentationConfigMap;
      oTelInstrumentationClass: string;
      configGenerator: <T extends { enabled?: boolean }>(
        config?: T
      ) => string | undefined;
    }
  >;
  private instrumentationModuleDefinitions: InstrumentationModuleDefinition[];
  private moduleVersionByPackageJsonPath: Map<string, string>;

  constructor(pluginConfig?: OpenTelemetryPluginParams) {
    this.pluginConfig = pluginConfig;
    validateConfig(pluginConfig);

    const {
      otelPackageToInstrumentationConfig,
      instrumentationModuleDefinitions,
    } = getOtelPackageToInstrumentationConfig(
      pluginConfig?.instrumentations ?? getNodeAutoInstrumentations()
    );

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
              extractedModule,
              moduleVersion,
              path: request,
            });
            if (!matchingInstrumentation) return undefined;

            const instrumentationName = matchingInstrumentation.name;
            const config =
              this.otelPackageToInstrumentationConfig[instrumentationName];
            if (!config) return undefined;

            const packageConfig = this.getPackageConfig(
              config.oTelInstrumentationPackage
            );

            if (!resolveData.createData.resourceResolveData)
              resolveData.createData.resourceResolveData = {};

            // TODO: Type this
            resolveData.createData.resourceResolveData.__otelPluginData = {
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
            if (normalModule.resourceResolveData.__otelPluginData) {
              // Ignore mjs files
              if (normalModule.request.endsWith(".js")) {
                normalModule.loaders.push({
                  loader: tempLoaderPath,
                  options: {
                    ...normalModule.resourceResolveData.__otelPluginData,
                    wrapModule,
                  },
                  ident: "OpenTelemetryWebpackPlugin",
                  type: "javascript/auto",
                });
              }
            }
          }
        );
      }
    );
  }

  getModuleVersion(
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

  getPackageConfig(
    oTelInstrumentationPackage: keyof EsbuildInstrumentationConfigMap
  ) {
    if (!this.pluginConfig) return;
    if (this.pluginConfig.instrumentations) {
      const matching = this.pluginConfig.instrumentations.find(
        (i) => i.instrumentationName === oTelInstrumentationPackage
      );
      if (!matching) {
        throw new Error(
          `Instrumentation ${oTelInstrumentationPackage} not found`
        );
      }
      return matching.getConfig();
    }
    return this.pluginConfig.instrumentationConfig?.[
      oTelInstrumentationPackage
    ];
  }
}

function validateConfig(pluginConfig?: OpenTelemetryPluginParams) {
  if (!pluginConfig) return;
  if (pluginConfig.instrumentationConfig && pluginConfig.instrumentations) {
    throw new Error(
      "OpenTelemetryPluginParams and instrumentations must not be used together"
    );
  }
}

function extractPackageAndModulePath(originalPath: string, resolveDir: string) {
  const resolved = require.resolve(originalPath, { paths: [resolveDir] });
  const nodeModulesIndex = resolved.lastIndexOf(NODE_MODULES);
  if (nodeModulesIndex < 0) return { path: resolved, extractedModule: null };

  const subPath = resolved.substring(nodeModulesIndex + NODE_MODULES.length);
  const firstSlash = subPath.indexOf("/");
  if (!subPath.startsWith("@")) {
    return {
      path: resolved,
      extractedModule: {
        package: subPath.substring(0, firstSlash),
        path: subPath.substring(firstSlash + 1),
      },
    };
  }

  const secondSlash = subPath.substring(firstSlash + 1).indexOf("/");
  return {
    path: resolved,
    extractedModule: {
      package: subPath.substring(0, firstSlash + secondSlash + 1),
      path: subPath.substring(firstSlash + secondSlash + 2),
    },
  };
}

function shouldIgnoreModule({
  // TODO: Is this fine or does this concept carry over?
  // namespace,
  path,
  importer,
  externalModules,
  pathPrefixesToIgnore,
}: {
  // namespace: string;
  path: string;
  importer: string;
  externalModules?: string[];
  pathPrefixesToIgnore?: string[];
}): boolean {
  // // If onLoad is being triggered from another plugin, ignore it
  // if (namespace !== "file") return true;
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

function isBuiltIn(path: string, extractedModule: ExtractedModule): boolean {
  return (
    BUILT_INS.has(path) ||
    BUILT_INS.has(`${extractedModule.package}/${extractedModule.path}`)
  );
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
  for (const def of instrumentationModuleDefinitions) {
    const fullModulePath = `${extractedModule.package}/${extractedModule.path}`;
    const nameMatches = def.name === path || def.name === fullModulePath;

    if (!nameMatches) {
      const fileMatch = def.files.find(
        (f) => f.name === path || f.name === fullModulePath
      );
      if (!fileMatch) continue;
    }

    if (def.supportedVersions.some((ver) => satisfies(moduleVersion, ver))) {
      return def;
    }

    if (
      def.files.some(
        (f) =>
          (f.name === path || f.name === fullModulePath) &&
          f.supportedVersions.some((ver) => satisfies(moduleVersion, ver))
      )
    ) {
      return def;
    }
  }

  return null;
}
