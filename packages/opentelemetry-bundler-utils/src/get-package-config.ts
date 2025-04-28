import {
  OpenTelemetryPluginParams,
  OtelPluginInstrumentationConfigMap,
} from "./types";

export function getPackageConfig({
  pluginConfig,
  oTelInstrumentationPackage,
}: {
  pluginConfig: OpenTelemetryPluginParams;
  oTelInstrumentationPackage: keyof OtelPluginInstrumentationConfigMap;
}) {
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
