import path from "path";
import { OpenTelemetryWebpackPlugin } from "@opentelemetry-bundler-plugins/opentelemetry-webpack-plugin-node";

import webpack from "webpack";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import TerserPlugin from "terser-webpack-plugin";
webpack(
  {
    target: "node",
    mode: "production",
    entry: path.normalize(`${__dirname}/../test-app/app.ts`),
    output: {
      path: path.normalize(`${__dirname}/../../test-dist/webpack`),
      filename: "app.js",
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            // The redis client instrumentation relies on a class name. Not specifically releavant
            // to this plugin, but that instrumentation package is a good test case
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
