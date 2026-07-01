import { fileURLToPath } from "url";
import { OpenTelemetryWebpackPlugin } from "opentelemetry-webpack-plugin-node";

import webpack from "webpack";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import TerserPlugin from "terser-webpack-plugin";

webpack(
  {
    target: "node",
    mode: "production",
    entry: fileURLToPath(new URL("../test-app/app.ts", import.meta.url)),
    output: {
      path: fileURLToPath(new URL("../../test-dist/webpack", import.meta.url)),
      filename: "app.cjs",
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            // The redis client instrumentation relies on a class name. Not specifically releavant
            // to this plugin, but that instrumentation package is a good test case
            // TODO: Document this
            keep_classnames: true,
          },
        }),
      ],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
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
          "@opentelemetry/instrumentation-pino": {
            logKeys: {
              traceId: "traceId",
              spanId: "spanId",
              traceFlags: "traceFlags",
            },
          },
          "@opentelemetry/instrumentation-fastify": {
            requestHook: (span) => {
              span.setAttribute("test.attribute", "test");
            },
          },
        }),
      }),
    ],
  },
  (err, stats) => {
    if (err || stats?.hasErrors()) {
      console.error(err, stats?.toString());
      throw err ?? new Error("Webpack compilation failed");
    }
  }
);
