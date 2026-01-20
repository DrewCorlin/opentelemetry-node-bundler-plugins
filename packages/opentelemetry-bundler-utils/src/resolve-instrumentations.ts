import { Instrumentation } from "@opentelemetry/instrumentation";
import { OpenTelemetryPluginParams } from "./types";

const AUTO_INSTRUMENTATION_MODULE =
  "@opentelemetry/auto-instrumentations-node";

type AutoInstrumentationFactory = (
  config?: Record<string, unknown>
) => Instrumentation[];

export function resolveInstrumentations(
  pluginConfig: OpenTelemetryPluginParams
): Instrumentation[] {
  if (pluginConfig.instrumentations) {
    return pluginConfig.instrumentations;
  }

  let factory: AutoInstrumentationFactory;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ getNodeAutoInstrumentations: factory } = require(AUTO_INSTRUMENTATION_MODULE));
  } catch (error) {
    throw new Error(
      `openTelemetryPlugin could not find any instrumentations. Install "${AUTO_INSTRUMENTATION_MODULE}" or provide the "instrumentations" option.`,
      { cause: error instanceof Error ? error : undefined }
    );
  }

  const instrumentations = factory(pluginConfig.instrumentationConfig ?? {});

  pluginConfig.instrumentations = instrumentations;
  return instrumentations;
}
