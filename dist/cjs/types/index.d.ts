import { InputPluginOption } from "rollup";
export interface PluginCppOptions {
    defaultExeName?: string;
    includePaths?: string[];
    memorySizes?: Partial<Record<string, number>>;
    buildMode?: "debug" | "release";
    wasiLib?: string;
    useTopLevelAwait?: boolean;
}
declare function pluginCpp({ includePaths, buildMode, wasiLib, useTopLevelAwait, memorySizes, defaultExeName }?: Partial<PluginCppOptions>): InputPluginOption;
export default pluginCpp;
export { pluginCpp };
