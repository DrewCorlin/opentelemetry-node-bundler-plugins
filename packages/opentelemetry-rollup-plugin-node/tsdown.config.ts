import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  tsconfig: "tsconfig.tsdown.json",
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  fixedExtension: false,
  platform: "node",
  attw: true,
  deps: {
    skipNodeModulesBundle: true,
  },
});
