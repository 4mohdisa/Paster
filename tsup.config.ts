import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./src/main/index.ts", "./src/preload/index.ts"],
	splitting: false,
	sourcemap: false,
	clean: true,
	cjsInterop: true,
	skipNodeModulesBundle: true,
	treeshake: true,
	outDir: "build",
	// external: ['electron'],
	format: ["cjs"],
	bundle: true,
});
