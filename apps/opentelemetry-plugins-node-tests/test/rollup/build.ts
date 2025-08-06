/*
 * Copyright The Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
          "@opentelemetry/instrumentation-pino": {
            logKeys: {
              traceId: "traceId",
              spanId: "spanId",
              traceFlags: "traceFlags",
            },
            logHook: (_, record) => {
              record["customFieldFromLogHook"] =
                "this is a custom field added by the log hook";
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

build().catch((err) => {
  throw err;
});
