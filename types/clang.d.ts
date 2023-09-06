export interface RunProgramArgs {
    returnsStdout: boolean;
}
export declare function runEmscripten(mode: "emcc" | "em++", args: string, opts?: Partial<RunProgramArgs>): Promise<string | void>;
export declare const testA = "";
export declare const $testA = "";
export declare const __testA = "";
