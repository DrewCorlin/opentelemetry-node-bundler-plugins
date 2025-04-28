import type { InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";

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
