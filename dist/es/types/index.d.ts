import { InputPluginOption } from "rollup";
export interface PluginCppOptions {
    includePaths?: string[];
    buildMode?: "debug" | "release";
    wasiLib?: string;
    useTopLevelAwait?: boolean;
}
declare function pluginCpp({ includePaths, buildMode, wasiLib, useTopLevelAwait }?: Partial<PluginCppOptions>): InputPluginOption;
export default pluginCpp;
