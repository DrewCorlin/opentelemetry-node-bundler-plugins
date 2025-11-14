## Installation

```bash
npm i -D opentelemetry-esbuild-plugin-node esbuild @opentelemetry/auto-instrumentations-node
```

## Usage: Esbuild plugin

This module includes instrumentation for all supported non-builtin instrumentations.
Please see the [Supported Instrumentations](#supported-instrumentations) section for more information.

Enable auto instrumentation by configuring it in your esbuild script:

```typescript
import { build } from "esbuild";
import { openTelemetryPlugin } from "opentelemetry-esbuild-plugin-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

build({
  entryPoints: "src/server.ts",
  bundle: true,
  outfile: "dist/esbuild/app.js",
  target: "node20",
  platform: "node",
  plugins: [
    openTelemetryPlugin({
      instrumentations: getNodeAutoInstrumentations({
        // Example of configuring an instrumentation
        "@opentelemetry/instrumentation-pino": {
          logKeys: {
            traceId: "traceId",
            spanId: "spanId",
            traceFlags: "traceFlags",
          },
        },
      }),
    }),
  ],
});
```

This esbuild script will instrument non-builtin packages but will not configure the rest of the OpenTelemetry SDK to export traces
from your application. To do that you must also configure the SDK.

The esbuild script currently only patches non-builtin modules (more specifically, modules in [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)), so this is also the place to configure the instrumentation
for builtins or add any additional instrumentations.

Note that you will still need to initialize the right exporters to get telemetry out of your application. This should be done as early as possible in your application lifecycle

```javascript
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: getNodeAutoInstrumentations({
    // Example of configuring an instrumentation
    "@opentelemetry/instrumentation-pino": {
      logKeys: {
        traceId: "traceId",
        spanId: "spanId",
        traceFlags: "traceFlags",
      },
    },
  }),
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

## External packages

If you have packages that you would like to treat as external and have this plugin ignore, use the `externalModules` options.

This is conceptually similar to [esbuild's external](https://esbuild.github.io/api/#external) option.

```typescript
build({
  entryPoints: "src/server.ts",
  bundle: true,
  outfile: "dist/esbuild/app.js",
  target: "node20",
  platform: "node",
  plugins: [
    openTelemetryPlugin({
      instrumentations: getNodeAutoInstrumentations(),
      externalModules: ["encoding"],
    }),
  ],
});
```

### Gotchas

Functions are supported in instrumentation configs, but be aware that they must be _pure_ (ie: they cannot reference any external values, only their parameters). This is because the configuration object is serialized/deserialized and embedded into the final bundle, and so the external scope of the function will be different than the one in the bundler configuration file.

## Supported instrumentations

See [the OpenTelemetry registry](https://opentelemetry.io/ecosystem/registry/?language=js&component=instrumentation) for the supported packages. Any OpenTelemetry plugin should work.

Note that Node.js builtin modules will not be patched by this plugin, but initializing the `NodeSDK` with plugins relevant to those modules (eg [@opentelemetry/instrumentation-undici](https://www.npmjs.com/package/@opentelemetry/instrumentation-undici)) will instrument them properly as the existing `require`-patching approach still works with built in modules.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For more about Esbuild plugins: <https://esbuild.github.io/plugins/>
