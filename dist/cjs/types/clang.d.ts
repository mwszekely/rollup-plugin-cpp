export interface RunProgramArgs {
    returnsStdout: boolean;
}
export declare function runEmscripten(args: string, opts?: Partial<RunProgramArgs>): Promise<string | void>;
