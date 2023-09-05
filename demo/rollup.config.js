
import resolve from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import datafile from "rollup-plugin-data";
import pluginCpp from "../dist/es/index.js";
// @ts-ignore

/** @type {import('rollup').RollupOptions} */
export default {
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
        (typescript)(),
        (resolve)(),
        pluginCpp({ useTopLevelAwait: false, includePaths: ["C:/Users/Matt/Documents/GitHub/wasm/demo/src/core/src"], buildMode: undefined, wasiLib: undefined }),
        (datafile)({ fileTypes: { ".wasm": { location: "asset" } } }),
        //wasmPlugin()
    ]
}