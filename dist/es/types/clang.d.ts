export interface RunProgramArgs {
    returnsStdout: boolean;
}
export declare function runEmscripten(mode: "emcc" | "em++", args: string, opts?: Partial<RunProgramArgs>): Promise<string | void>;
