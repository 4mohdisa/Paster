import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./main/index.ts", "./preload/index.ts"],
	splitting: false,
	sourcemap: false,
	clean: true,
	cjsInterop: true,
	skipNodeModulesBundle: true,
	treeshake: true,
	outDir: "build",
	target: "node22",
	// external: ['electron'],
	format: ["cjs"],
	bundle: true,
});
