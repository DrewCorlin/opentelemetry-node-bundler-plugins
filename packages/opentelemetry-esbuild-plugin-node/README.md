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
  outfile: "test-dist/esbuild/app.js",
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

### Gotchas

NB: Not all config options for each instrumentation will be respected. Notably, functions must be pure.
That is not rely on closed over variables, with the exception of a few safe globals:

- `console`
- `Math`
- `Error`
- `AssertionError`
- `RangeError`
- `ReferenceError`
- `SyntaxError`
- `SystemError`
- `TypeError`
- `Date`
- `JSON`
- `Number`
- `String`
- `Boolean`
- `parseInt`
- `parseFloat`

This works:

```typescript
openTelemetryPlugin({
  instrumentations: [
    new PinoInstrumentation({
      logHook: (span, record) => {
        record["resource.service.name"] =
          provider.resource.attributes["service.name"];
      },
    }),
  ],
});
```

and so does this:

```typescript
openTelemetryPlugin({
  instrumentations: [
    new PinoInstrumentation({
      logHook: (span, record) => {
        record["resource.service.id"] = parseInt(
          Iprovider.resource.attributes["service.id"]
        );
      },
    }),
  ],
});
```

This would not, despite being valid javascript/typescript

```typescript
function getServiceName() {
  return "service-name";
}

openTelemetryPlugin({
  instrumentations: [
    new PinoInstrumentation({
      logHook: (span, record) => {
        record["resource.service.name"] = getServiceName();
      },
    }),
  ],
});
```

The reason for this is that the current mechanism of instrumenting packages involves stringifying the instrumentation configs, which involves stringifying functions. Stringifying functions with closed over state is very difficult.

## Supported instrumentations

See [the OpenTelemetry registry](https://opentelemetry.io/ecosystem/registry/?language=js&component=instrumentation) for the supported packages. Any OpenTelemetry plugin should work.

Note that Node.js builtin modules will not be patched by this plugin, but initializing the `NodeSDK` with plugins relevant to those modules (eg [@opentelemetry/instrumentation-undici](https://www.npmjs.com/package/@opentelemetry/instrumentation-undici)) will instrument them properly as the existing `require`-patching approach still works with built in modules.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For more about Esbuild plugins: <https://esbuild.github.io/plugins/>
