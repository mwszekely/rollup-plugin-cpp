/// <reference types="node" />
import type { Plugin, RollupOptions } from "rollup";
export declare function readFile(path: string, mode: "string"): Promise<string>;
export declare function readFile(path: string, mode: "binary"): Promise<Buffer>;
export declare function getDatafilePlugin(options: RollupOptions): Plugin | null;
