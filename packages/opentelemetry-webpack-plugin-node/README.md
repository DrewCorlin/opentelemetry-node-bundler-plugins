## Installation

```bash
npm i -D opentelemetry-webpack-plugin-node webpack @opentelemetry/auto-instrumentations-node terser-webpack-plugin
```

## Usage: Webpack plugin

This module includes instrumentation for all supported non-builtin instrumentations.
Please see the [Supported Instrumentations](#supported-instrumentations) section for more information.

Enable auto instrumentation by configuring it in your webpack script:

```typescript
import { OpenTelemetryWebpackPlugin } from "opentelemetry-webpack-plugin-node";

import webpack from "webpack";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import TerserPlugin from "terser-webpack-plugin";
webpack(
  {
    target: "node",
    mode: "production",
    entry: "src/server.ts",
    output: {
      path: "dist/webpack",
      filename: "app.js",
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            // The redis client instrumentation relies on a class name. You can remove this if you are not using redis
            keep_classnames: true,
          },
        }),
      ],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          type: "javascript/auto",
          test: /\.mjs$/,
          use: {
            loader: "babel-loader",
            options: {
              targets: "defaults",
              presets: [["@babel/preset-env", { modules: "commonjs" }]],
            },
          },
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js", ".mjs"],
    },
    plugins: [
      new OpenTelemetryWebpackPlugin({
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
  },
  (err, stats) => {
    if (err || stats?.hasErrors()) {
      console.error(err, stats?.toString());
      throw err;
    }
  }
);
```

This webpack build script will instrument non-builtin packages but will not configure the rest of the OpenTelemetry SDK to export traces
from your application. To do that you must also configure the SDK.

The webpack build script currently only patches non-builtin modules (more specifically, modules in [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)), so this is also the place to configure the instrumentation
for builtins or add any additional instrumentations.

Note that you will still need to initialize the right exporters to get telemetry out of your application. This should be done as early as possible in your application lifecycle

```javascript
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: getNodeAutoInstrumentations(),
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

### Gotchas

There are limitations to the configuration options for each package. Most notably, any functions are not allowed to be passed in to plugins.

The reason for this is that the current mechanism of instrumenting packages involves stringifying the instrumentation configs, which does not account for any external scoped dependencies, and thus creates subtle opportunities for bugs.

## Supported instrumentations

See [the OpenTelemetry registry](https://opentelemetry.io/ecosystem/registry/?language=js&component=instrumentation) for the supported packages. Any OpenTelemetry plugin should work.

Note that Node.js builtin modules will not be patched by this plugin, but initializing the `NodeSDK` with plugins relevant to those modules (eg [@opentelemetry/instrumentation-undici](https://www.npmjs.com/package/@opentelemetry/instrumentation-undici)) will instrument them properly as the existing `require`-patching approach still works with built in modules.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For more about Webpack plugins: <https://webpack.js.org/plugins/>
