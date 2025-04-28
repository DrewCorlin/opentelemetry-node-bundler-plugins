import type { InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";
import { Instrumentation } from "@opentelemetry/instrumentation";

export interface ExtractedModule {
  package: string;
  path: string;
}

type BuiltinPackages =
  | "@opentelemetry/instrumentation-dns"
  | "@opentelemetry/instrumentation-fs"
  | "@opentelemetry/instrumentation-http";

type NonBuiltinInstrumentationConfigMap = Omit<
  InstrumentationConfigMap,
  BuiltinPackages
>;

type _RemoveFunctions<T> = {
  [P in keyof T as T[P] extends (...args: unknown[]) => unknown
    ? never
    : P]: T[P];
};

// _RemoveFunctions does not work on optional fields, so first make the type required then apply Partial to the result
type RemoveFunctions<T> = Partial<_RemoveFunctions<Required<T>>>;

// TODO: Do we need this or should it just all be strings (assuming people will bring their own plugins, not just use one from auto-instrumentations-node)
export type OtelPluginInstrumentationConfigMap = {
  [K in keyof NonBuiltinInstrumentationConfigMap]: RemoveFunctions<
    NonBuiltinInstrumentationConfigMap[K]
  >;
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
