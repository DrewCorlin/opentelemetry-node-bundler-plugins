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

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import path from "path";

async function build() {
  const [{ rolldown }, { openTelemetryPlugin }] = await Promise.all([
    import("rolldown"),
    import("opentelemetry-unplugin-node"),
  ]);

  const bundle = await rolldown({
    input: path.normalize(`${__dirname}/../test-app/app.ts`),
    platform: "node",
    plugins: [
      openTelemetryPlugin.rolldown({
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
  });

  await bundle.write({
    file: path.normalize(`${__dirname}/../../test-dist/unplugin-rolldown/app.js`),
    format: "cjs",
  });

  await bundle.close();
}

build().catch((err) => {
  throw err;
});
