## About

These modules provide a way to auto instrument any Node application to capture telemetry from a number of popular libraries and frameworks, via a bundler plugins.

The net result is the ability to gather telemetry data from a Node application without any code changes to your application.

This module also provides a simple way to manually initialize multiple Node instrumentations for use with the OpenTelemetry SDK.

These packages include instrumentation for all supported non-builtin instrumentations (builtin instrumentations work out of the box even with bundlers).

Compatible with OpenTelemetry JS API and SDK `1.0+`.

See each packages README for more details

- [opentelemetry-esbuild-plugin-node](./packages/opentelemetry-esbuild-plugin-node/README.md)
- [opentelemetry-webpack-plugin-node](./packages/opentelemetry-webpack-plugin-node/README.md)
- [opentelemetry-rollup-plugin-node](./packages/opentelemetry-rollup-plugin-node/README.md)

### Why

The existing auto instrumentation provided by OpenTelemetry relies on patching the global `require` function, to intercept packages
on first import and add instrumentation. When bundling your code into a single JS file all `require()` calls are removed, breaking this approach.

These plugins effectively move that patching from runtime (import time) to build time, leveraging the same patching that individual instrumentations provide to wrap modules in a few lines of code so that they are still instrumented even after bundling.

### Releasing

See [RELEASE.md](./RELEASE.md)
