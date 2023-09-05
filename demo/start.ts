
import resolve from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import { RollupOptions, watch } from "rollup";
import datafile from "rollup-plugin-data";
// @ts-ignore
import myExample from "../dist/es/index.js";


(async () => {

    const options = {
        input: "./src/index.ts",
        watch: {
            clearScreen: false
        },
        output: {
            dir: "./dist",
            format: "iife"
            //file: "./dist/test-output.js"
        },
        plugins: [
            (typescript as any)(),
            (resolve as any)(),
            myExample({ useTopLevelAwait: false, includePaths: ["C:/Users/Matt/Documents/GitHub/wasm/demo/src/core/src"], buildMode: undefined, wasiLib: undefined, memorySizes: {}, defaultExeName: undefined }),
            (datafile as any)({ fileTypes: { ".wasm": { location: "asset" } } }),
            //wasmPlugin()
        ]
    } satisfies RollupOptions;

    const watcher = watch(options);
    /*watcher.on("change", (id, change) => { console.log("change", id, change) });
    watcher.on("event", (e) => { console.log("event", e) });
    watcher.on("restart", () => { console.log("restart") });*/

    await new Promise<void>((resolve) => {
        watcher.on("close", () => { console.log("close"); resolve(); });
    })

    /*const build = await rollup(options);
    await build.write(options.output);*/
})()

