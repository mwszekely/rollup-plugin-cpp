import { InputPluginOption } from "rollup";
import type { CppMeta } from "./types.js";
export type { CppMeta };
export interface PluginCppOptions {
    defaultExeName?: string;
    includePaths?: string[];
    memorySizes?: Partial<Record<string, number>>;
    buildMode?: "debug" | "release";
    wasiLib?: string;
    noWat?: boolean;
    useTopLevelAwait?: boolean;
}
declare function pluginCpp({ includePaths, buildMode, wasiLib, useTopLevelAwait, memorySizes, defaultExeName, noWat }?: Partial<PluginCppOptions>): InputPluginOption;
export default pluginCpp;
export { pluginCpp };
