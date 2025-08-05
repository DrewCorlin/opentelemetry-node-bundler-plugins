## Installation

```bash
npm i -D opentelemetry-rollup-plugin-node rollup @opentelemetry/auto-instrumentations-node @rollup/plugin-typescript @rollup/plugin-commonjs @rollup/plugin-node-resolve @rollup/plugin-json
```

## Usage: Rollup plugin

This module includes instrumentation for all supported non-builtin instrumentations.
Please see the [Supported Instrumentations](#supported-instrumentations) section for more information.

Enable auto instrumentation by configuring it in your rollup script:

```typescript
import { rollup } from "rollup";
import { openTelemetryPlugin } from "opentelemetry-rollup-plugin-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import path from "path";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

async function build() {
  const bundle = await rollup({
    input: path.normalize(`${__dirname}/../test-app/app.ts`),
    plugins: [
      nodeResolve({ extensions: [".mjs", ".js", ".json", ".ts"] }),
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
      commonjs(),
      json(),
      typescript({
        tsconfig: path.normalize(`${__dirname}/../../tsconfig.json`),
        sourceMap: false,
      }),
    ],
  });

  await bundle.write({
    file: path.normalize(`${__dirname}/../../test-dist/rollup/app.js`),
    format: "cjs",
  });

  await bundle.close();
}

build();
```

This rollup script will instrument non-builtin packages but will not configure the rest of the OpenTelemetry SDK to export traces
from your application. To do that you must also configure the SDK.

The rollup build script currently only patches non-builtin modules (more specifically, modules in [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)), so this is also the place to configure the instrumentation
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

Functions are supported in instrumentation configs, but be aware that they must be _pure_ (ie: they cannot reference any external values, only their parameters). This is because the configuration object is serialized/deserialized and embedded into the final bundle, and so the external scope of the function will be different than the one in the bundler configuration file.

## Supported instrumentations

See [the OpenTelemetry registry](https://opentelemetry.io/ecosystem/registry/?language=js&component=instrumentation) for the supported packages. Any OpenTelemetry plugin should work.

Note that Node.js builtin modules will not be patched by this plugin, but initializing the `NodeSDK` with plugins relevant to those modules (eg [@opentelemetry/instrumentation-undici](https://www.npmjs.com/package/@opentelemetry/instrumentation-undici)) will instrument them properly as the existing `require`-patching approach still works with built in modules.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For more about Rollup plugins: <https://rollupjs.org/plugin-development/#plugins-overview>
