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
import * as assert from "assert";

import { exec as execCb, spawnSync } from "child_process";
import { rm } from "fs/promises";
import path from "path";
import { describe, before, after, it } from "node:test";

import { promisify } from "util";

const exec = promisify(execCb);

function startTestApp(bundler: string) {
  return spawnSync(
    process.execPath,
    ["--require", "./test-app/register.js", `../test-dist/${bundler}/app.js`],
    {
      cwd: __dirname,
      timeout: 60_000,
      killSignal: "SIGKILL", // SIGTERM is not sufficient to terminate some hangs
      env: {
        ...process.env,
        OTEL_NODE_RESOURCE_DETECTORS: "none",
        OTEL_TRACES_EXPORTER: "console",
        // nx (used by lerna run) defaults `FORCE_COLOR=true`, which in
        // node v18.17.0, v20.3.0 and later results in ANSI color escapes
        // in the ConsoleSpanExporter output that is checked below.
        FORCE_COLOR: "0",
      },
    }
  );
}

function getTraceId(
  stdOutLines: string[],
  spanName: string
): string | undefined {
  const traceLines = getTrace(stdOutLines, spanName);
  if (!traceLines) return;
  const traceId = /traceId: '([0-9a-f]+)'/.exec(traceLines)?.[1];

  return traceId;
}

function getTrace(stdOutLines: string[], spanName: string) {
  const traceLogNameLineIndex = stdOutLines.findIndex((logLine) =>
    logLine.includes(`name: '${spanName}'`)
  );
  if (traceLogNameLineIndex === -1) return;

  const logsBeforeName = stdOutLines.slice(0, traceLogNameLineIndex);
  const logsIncludingAndAfterName = stdOutLines.slice(traceLogNameLineIndex);
  const openingBracketLineIndex = logsBeforeName.lastIndexOf("{");
  const closingBracketLineIndex =
    traceLogNameLineIndex + logsIncludingAndAfterName.indexOf("}") + 1;

  return stdOutLines
    .slice(openingBracketLineIndex, closingBracketLineIndex)
    .join("");
}

[
  {
    scriptFile: "build.ts",
    bundler: "esbuild",
    distFiles: ["app.js"],
  },
  {
    scriptFile: "build.ts",
    bundler: "webpack",
    distFiles: ["app.js", "app.js.LICENSE.txt"],
  },
].forEach(({ scriptFile, bundler, distFiles }) => {
  describe(
    bundler + " can instrument packages via a plugin: " + scriptFile,
    { timeout: 60_000 },
    function () {
      let stdOutLines: string[] = [];

      before(async () => {
        const enabledInstrumentations = [
          ...getNodeAutoInstrumentations().map((i) =>
            i.instrumentationName.replace("@opentelemetry/instrumentation-", "")
          ),
          // Using fastify in the test server so enable it
          "fastify",
        ];
        await exec(
          `OTEL_NODE_ENABLED_INSTRUMENTATIONS=${enabledInstrumentations.join(",")} ts-node ${__dirname}/${bundler}/${scriptFile}`
        );

        const proc = startTestApp(bundler);

        assert.ifError(proc.error);
        assert.equal(proc.status, 0, `proc.status (${proc.status})`);
        assert.equal(proc.signal, null, `proc.signal (${proc.signal})`);

        const stdOut = proc.stdout.toString();
        stdOutLines = stdOut.split("\n");

        assert.ok(
          stdOutLines.find(
            (logLine) =>
              logLine ===
              "OpenTelemetry automatic instrumentation started successfully"
          )
        );
      });

      after(async () => {
        for (const distFile of distFiles) {
          await rm(
            path.normalize(`${__dirname}/../test-dist/${bundler}/${distFile}`)
          );
        }
      });

      it("fastify and pino", async () => {
        assert.ok(
          stdOutLines.find(
            (logLine) =>
              logLine ===
              "OpenTelemetry automatic instrumentation started successfully"
          )
        );

        const traceId = getTraceId(
          stdOutLines,
          "request handler - fastify -> @fastify/rate-limit"
        );

        assert.ok(
          traceId,
          "console span output in stdout contains a fastify span"
        );

        const requestHandlerLogMessage = stdOutLines.find((line) =>
          line.includes("Log message from handler")
        );

        assert.ok(requestHandlerLogMessage, "Log message handler is triggered");
        const { traceId: pinoTraceId } = JSON.parse(requestHandlerLogMessage);
        assert.equal(traceId, pinoTraceId, "Pino logs include trace ID");
      });

      it("redis", async () => {
        const traceId = getTraceId(stdOutLines, "redis-GET");

        assert.ok(
          traceId,
          "console span output in stdout contains a redis span"
        );
      });

      it("mongodb", async () => {
        const traceId = getTraceId(stdOutLines, "mongodb.find");

        assert.ok(traceId, "console span output in stdout contains a traceId");
      });

      describe("graphql", () => {
        it("should instrument parse", () => {
          const parseSpan = getTrace(stdOutLines, "graphql.parse");
          assert.ok(parseSpan, "There is a span for graphql.parse");
        });

        it("should instrument validate", () => {
          const parseSpan = getTrace(stdOutLines, "graphql.validate");
          assert.ok(parseSpan, "There is a span for graphql.validate");
        });

        it("should instrument execute", () => {
          const parseSpan = getTrace(stdOutLines, "query");
          assert.ok(parseSpan, "There is a span for query");
        });
      });
    }
  );
});
