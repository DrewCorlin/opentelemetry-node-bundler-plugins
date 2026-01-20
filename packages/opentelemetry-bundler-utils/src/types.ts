import {
  Instrumentation,
  InstrumentationConfig,
} from "@opentelemetry/instrumentation";

export interface ExtractedModule {
  package: string;
  path: string;
}

export type OtelPluginInstrumentationConfigMap = Record<
  string,
  InstrumentationConfig
>;

export type InstrumentationConfigOverrides = Record<
  string,
  InstrumentationConfig | Record<string, unknown> | undefined
>;

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
   * Instrumentations to apply.
   *
   * If omitted, the plugin will attempt to `require()` an auto-instrumentation
   * module (defaults to `@opentelemetry/auto-instrumentations-node`) and call
   * its `getNodeAutoInstrumentations` helper.
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

  /**
   * Optional configuration map that is passed to the auto-instrumentation
   * module when `instrumentations` are not provided.
   */
  instrumentationConfig?: InstrumentationConfigOverrides;
}
