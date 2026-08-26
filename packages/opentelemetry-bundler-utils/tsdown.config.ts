import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  tsconfig: "tsconfig.tsdown.json",
  format: ["esm", "cjs"],
  sourcemap: true,
  dts: true,
  clean: true,
  fixedExtension: false,
  platform: "node",
  attw: true,
  deps: {
    alwaysBundle: ["rolldown-string"],
    onlyBundle: false,
  },
});
