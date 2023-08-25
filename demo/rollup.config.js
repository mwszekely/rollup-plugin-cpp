
import resolve from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import datafile from "rollup-plugin-data";
// @ts-ignore
import pluginCpp from "../dist/es/index.js";

/** @type {import('rollup').RollupOptions} */
export default {
    input: "./src/index.ts",
    watch: { 
        clearScreen: false 
    },
    output: {
        dir: "./dist",
        format: "es"
        //file: "./dist/test-output.js"
    },
    plugins: [
        (typescript)(),
        (resolve)(),
        pluginCpp({ useTopLevelAwait: true, includePaths: ["C:/Users/Matt/Documents/GitHub/wasm/demo/src/core/src"], buildMode: "debug" }),
        (datafile)({ useTopLevelAwait: true, fileTypes: { ".wasm": { location: "asset" } } }),
        //wasmPlugin()
    ]
}