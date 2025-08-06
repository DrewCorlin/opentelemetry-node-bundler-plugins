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
   * NB: Not all config options for each instrumentation will be respected. Notably, functions must be pure.
   * That is not rely on closed over variables, with the exception of a few safe globals:
   * * `console`
   * * `Math`
   * * `Error`
   * * `AssertionError`
   * * `RangeError`
   * * `ReferenceError`
   * * `SyntaxError`
   * * `SystemError`
   * * `TypeError`
   * * `Date`
   * * `JSON`
   * * `Number`
   * * `String`
   * * `Boolean`
   * * `parseInt`
   * * `parseFloat`
   *
   * This works:
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
   * and so does this:
   * ```typescript
   * openTelemetryPlugin({
   *   instrumentations: [
   *     new PinoInstrumentation({
   *       logHook: (span, record) => {
   *         record['resource.service.id'] = parseInt(Iprovider.resource.attributes['service.id']);
   *       }
   *     })
   *   ]
   * })
   * ```
   *
   * This would not, despite being valid javascript/typescript
   * ```typescript
   * function getServiceName() {
   *   return "service-name";
   * }
   *
   * openTelemetryPlugin({
   *   instrumentations: [
   *     new PinoInstrumentation({
   *       logHook: (span, record) => {
   *         record['resource.service.name'] = getServiceName();
   *       }
   *     })
   *   ]
   * })
   * ```
   */
  instrumentations: Instrumentation[];
}
