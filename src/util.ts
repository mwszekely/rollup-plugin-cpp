import { readFile as readFileNode } from "fs/promises";
import type { Plugin, RollupOptions } from "rollup";

export async function readFile(path: string, mode: "string"): Promise<string>;
export async function readFile(path: string, mode: "binary"): Promise<Buffer>;
export async function readFile(path: string, mode: "string" | "binary"): Promise<string | Buffer> {
    try {
        let ret;
        if (mode != "string")
            ret = await readFileNode(path);
        else
            ret = await readFileNode(path, { encoding: "utf-8" });
        return ret;
    }
    catch (ex) {
        throw ex;
    }
}

export function getDatafilePlugin(options: RollupOptions): Plugin | null {

    const datafilePluginName = 'rollup-plugin-datafile';
    if (Array.isArray(options.plugins)) {
        const parentPlugin = options.plugins.find(
            plugin => (plugin as Plugin)?.name === datafilePluginName
        ) as Plugin;
        return parentPlugin || null;
    }
    return null;
}