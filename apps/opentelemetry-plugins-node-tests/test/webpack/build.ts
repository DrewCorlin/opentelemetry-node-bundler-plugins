import path from "path";
import { OpenTelemetryWebpackPlugin } from "@opentelemetry-bundler-plugins/opentelemetry-webpack-plugin-node";

import webpack from "webpack";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

webpack(
  {
    target: "node",
    // TODO: production
    // mode: "production",
    mode: "development",
    entry: path.normalize(`${__dirname}/../test-app/app.ts`),
    output: {
      path: path.normalize(`${__dirname}/../../test-dist/webpack`),
      filename: "app.js",
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js"],
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
