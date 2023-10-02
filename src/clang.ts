import { ExecException, exec } from "child_process";
export interface RunProgramArgs { returnsStdout: boolean }

// This is to avoid showing the emcc banner when we just call it for --version (to see if it exists).
// We want to only show it if we use emcc to compile something.
let banner = "";
let shownBanner = false;

async function runProgram(prog: string, args: string, { returnsStdout }: Partial<RunProgramArgs> = {}) {
    returnsStdout ||= false;

    let resolve!: () => void;
    let reject!: (e: string) => void;
    let promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; })

    let allStdOut = new Array<string>();
    const cb = (error: ExecException | null, stdout: string, stderr: string) => {
        if (stdout.startsWith("emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld)")) {
        }
        if (error) {
            const result = /^wasm-ld: error: ((.+?):\s+(.+?):\s+(.+))/.exec(stderr);
            if (result) {
                if (result[3] == "undefined symbol") {
                    console.error(`There was a linker error; C++ dependencies must be imported manually to resolve the reference to "${result[4]}" i.e. by importing the C++ file that defines that. The original error is as follows:`);
                }
                else {
                    console.error(`An unknown linker error occurred, which I'm sure will be very fun to debug:`);
                }
                console.error(result[1]);
            }
            reject(stderr);
        }
        if (stdout != null && stdout != "") {
            if (stdout.startsWith("emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld)") && stdout.includes("This is free and open source software under the MIT license.")) {
                banner = stdout;
                return;
            }
            else {
                allStdOut.push(stdout);
            }
        }
    };

    let childProcess = exec(`${prog} ${args}`, cb);
    childProcess.on("close", (_code: number | null, signal: string | null) => {
        if (signal) {
            reject(signal);
        }
        else {
            resolve();
        }
    })

    const ret = await promise;
    if (returnsStdout)
        return allStdOut.join("\n");

    if (allStdOut.length)
        console.log(...allStdOut);
    return ret;
}

export function tryShowBanner() {
    if (!shownBanner) {
        shownBanner = true;
        console.log(banner);
    }
}

export async function runEmscripten(mode: "emcc" | "em++", args: string, opts: Partial<RunProgramArgs> = {}) {
    return runProgram(mode, `${args}`, opts);
}
/*
export async function runClang(args: string) {
    return runProgram("clang++", `${args} -fms-extensions -I "C:/Program Files (x86)/Windows Kits/10/Include/10.0.22621.0/ucrt" -I "C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.37.32822/include"`);
}

export async function runLoader(args: string) {
    return runProgram("wasm-ld", args);
}
*/
export const testA = "";
export const $testA = "";
export const __testA = "";