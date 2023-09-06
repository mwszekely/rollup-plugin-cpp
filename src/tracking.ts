import { normalizePath } from "@rollup/pluginutils";
import { mkdir } from "fs/promises";
import { MapOfSets } from "map-and-set-extensions";
import { basename, dirname, join, relative } from "path";
import { cwd, stdout } from "process";
import { clearLine, cursorTo } from "readline";
import { PluginContext, RollupOptions } from "rollup";
import { runEmscripten } from "./clang.js";
import { getBinaryen } from "./get-binaryen.js";
import { readFile } from "./util.js";
export const HELPER_IMPORT_FINAL_WASM_0 = "\0__WASM_IMPORT_FINAL_";
export const HELPER_IMPORT_HANDLE_WASM_DATA = "\0__HELPER_IMPORT_HANDLE_WASM_DATA_"

export function funnyStartsWith<U extends string>(input: string, startsWith: U): input is `${U}${number}` {
    return input.startsWith(startsWith);
}

// Basically just a wrapper around a Map<>
export class ExecutionUnits {
    executionUnitsByName = new Map<string, ExecutionUnit>();
    cppFilesById = new Map<number, CppSourceFile>();
    wasmFilesById = new Map<number, WasmFile>();
    executionUnitsById = new Map<number, ExecutionUnit>();
    context: PluginContext | null = null;


    cppUniqueIdCounter = 0;
    exeUniqueIdCounter = 0;
    wasmUniqueIdCounter = 0;

    constructor(public inputOptions: RollupOptions, public buildMode: "debug" | "release", public compilerOptions: { defaultExeName: string, includePaths: string[], memorySizes: Partial<Record<string, number>> }) {

    }
    getByUrl(path: string): ExecutionUnit {
        if (path.includes(".c")) {
            let exeUnitName = this.compilerOptions.defaultExeName || "default";
            let url: URL | undefined;
            try {
                url = new URL(`ext:${path}`);
            }
            catch (ex) {
                return undefined!;
            }

            if (url.pathname.endsWith(".cpp") || url.pathname.endsWith(".c") || url.pathname.endsWith(".cc")) {
                if (url.searchParams.has("exe")) {
                    exeUnitName = url.searchParams.get("exe")!;
                }

                return this.getByName(exeUnitName)!;
            }
        }
        return undefined!
    }
    getById(id: `${typeof HELPER_IMPORT_FINAL_WASM_0}${number}` | number): ExecutionUnit {
        if (typeof id == "string" && id.startsWith(HELPER_IMPORT_FINAL_WASM_0))
            return this.getById(parseInt(id.substring(HELPER_IMPORT_FINAL_WASM_0.length)));
        console.assert(this.executionUnitsById.has(id as number));
        return this.executionUnitsById.get(id as number)!;
    }
    getByName(exe: string) {
        if (!this.executionUnitsByName.has(exe))
            this.executionUnitsByName.set(exe, new ExecutionUnit(this, exe, this.compilerOptions.memorySizes[exe] || 0x1_00_00_00));
        return this.executionUnitsByName.get(exe)!;
    }


    getCppFileById(id: number): CppSourceFile {
        /*if (typeof id === 'string') {
            return this.getCppFileById(parseInt(id.substring(HELPER_IMPORT_CPP_.length)))
        }
        else*/ {
            let file = this.cppFilesById.get(id);
            if (!file) {
                debugger;
                throw new Error(`Internal error: missing c++ file ${id}`);
            }
            return file;
        }
    }

    getWasmFile(id: number): WasmFile {
        /*if (typeof id === 'string') {
            return this.getWasmFile(parseInt(id.substring(HELPER_IMPORT_WASM_.length)))
        }
        else*/ {
            let file = this.wasmFilesById.get(id);
            if (!file) {
                debugger;
                throw new Error(`Internal error: missing wasm file ${id}`);
            }
            return file;
        }
    }
}



export class ExecutionUnit {
    private cppFilesByPath = new Map<string, CppSourceFile>();
    private cppFilesById = new Map<number, CppSourceFile>();
    public cppFilesByHeaderPath = new Map<string, Set<CppSourceFile>>();
    private wasmFilesByPath = new Map<string, WasmFile>();
    private wasmFilesById = new Map<number, WasmFile>();
    flagsClang = "";    // Used when compiling a C++ files to a WASM files
    flagsLinker = "";   // Used when linking multiple WASM files together
    uniqueId;

    private onWriteResolve!: () => void;
    onWritePromise: Promise<void>;
    private onWriteReject!: (e: any) => void;
    constructor(public parent: ExecutionUnits, public key: string, public memorySize: number) {
        this.uniqueId = this.parent.exeUniqueIdCounter++;
        this.parent.executionUnitsById.set(this.uniqueId, this);

        this.onWritePromise = new Promise((resolve, _reject) => { this.onWriteResolve = resolve; this.onWriteReject = this.onWriteReject; });
    }

    //get outputTempWasmPath() { return `./temp/exe_${this.uniqueId}.wasm` }

    imports: Array<{ module: string, base: string, type: "function" | "global" | "table" }> = [];

    // `null` indicates "export all"
    private importsFromJs: Set<string> | null = new Set<string>();
    jsImportsAll(): void { this.importsFromJs = null; }



    /**
     * When the JS that imports a C++ files is parsed,
     * we examine the import to see the names of the functions (etc.) that are used
     * and store them by calling this member function.
     */
    addImportFromJs(str: string): void {
        this.importsFromJs?.add(str);
    }

    get includePathsAsArgument() {
        return this.parent.compilerOptions.includePaths.map(includePath => `-I "${includePath}"`).join(" ")
    }

    get finalFilePath() { return `modules/${this.key}.wasm` }

    /**
     * Does a few things:
     * 
     * * Compiles each individual C++ source file
     * * Links each individual WASM file
     * * Finds all the remaining imports that need to be linked at runtime
     * * Tells the datafile plugin that files have been written and that Rollup's `emitFile` can be called.
     * 
     * @returns 
     */
    async compile() {
        await mkdir(dirname(this.finalFilePath), { recursive: true });
        let projectDir = cwd();
        const finalTempPath = relative(projectDir, this.finalFilePath);


        const argsExportedFunctions =
            this.importsFromJs == null ? "-sLINKABLE=1 -sEXPORT_ALL=2" :
                (this.importsFromJs.size ? `-sEXPORTED_FUNCTIONS=${[...this.importsFromJs].map(i => `_${i}`).join(",")}` : "");

        let argsShared = "--no-entry -std=c++20 -fwasm-exceptions -sALLOW_MEMORY_GROWTH=1"; // -sSTANDALONE_WASM=1  // -sMINIMAL_RUNTIME=2
        let argsDebug = `-g -gdwarf-4 -gsource-map`;
        let argsRelease = `-flto -O3`;

        const finalArgs: string[] = [
            this.includePathsAsArgument,
            argsShared,
            (this.parent.buildMode == "debug" ? argsDebug : argsRelease)
        ];

        let b: any;

        if (this.cppFilesByPath.size == 0) {
            console.log(`No C++ files were imported. Nothing to compile...`);
        }
        else {
            //let maxLen = 0;
            console.log(`Compiling individual C++ files to object files...`);
            let count = 0;
            await Promise.all([...this.cppFilesByPath].map(async ([path, cppFile]) => {
                if (cppFile.wasm.objNeedsRebuild) {
                    cppFile.wasm.objNeedsRebuild = false;
                    const emscriptenArgs: string[] = [
                        ...finalArgs,
                        "-c",                                        // Compile only and don't link; turn this source file into a yet-to-be-linked object file.
                        `-o ${cppFile.wasmPath}`,                    // The output path of the object file
                        path                                         // The input path of the source file
                    ];
                    try {
                        await runEmscripten(path.toLowerCase().endsWith(".c")? "emcc" : "em++", emscriptenArgs.join(" "));
                    }
                    catch (ex) {
                        stdout.write("\n");
                        console.log(ex);
                        stdout.write("\n");
                    }
                    clearLine(stdout, 0);
                    cursorTo(stdout, 0, undefined);
                    stdout.write(`Compiling to ${cppFile.wasm.path}...`);

                    const newData = await readFile(cppFile.wasm.path, "binary");


                    this.exeNeedsRebuild ||= (cppFile.wasm.contents == null || (newData.compare(new Uint8Array(cppFile.wasm.contents)) != 0));

                    cppFile.wasm.contents = newData;

                    ++count;
                }
                else {
                    return Promise.resolve();
                }
            }));
            clearLine(stdout, 0);
            cursorTo(stdout, 0, undefined);
            stdout.write(`Compiled ${count}/${this.cppFilesByPath.size} source files.\n`);

            if (!this.exeNeedsRebuild) {
                console.log(`There were no changes to the individual .wasm files, so the final file does not need rebuilt.`)
            }
            else {
                this.exeNeedsRebuild = false;
                console.log(`${this.wasmFilesById.size == 1? "Rec" : "C"}ompiling ${this.wasmFilesById.size == 1? "the object file": this.wasmFilesById.size == 2? "both object files together" : `all ${this.wasmFilesById.size} object files together`} into the final executable...`)

                const args = [
                    Array.from(this.wasmFilesById).map(([_id, wasm]) => wasm.path).join(" "),
                    `-o ${finalTempPath}`,
                    ...finalArgs,
                    argsExportedFunctions,
                ].join(" ")

                await runEmscripten("em++", `${args}`);
                //const finalWasmContents = await readFile(this.finalFilePath, "binary");
                //this.parent.context!.setAssetSource(this.fileReferenceId, finalWasmContents);
                const binaryen = await getBinaryen()
                b = binaryen.readBinary(await readFile(finalTempPath, "binary"));


                for (let i = 0; i < b.getNumFunctions(); ++i) {
                    const func = binaryen.getFunctionInfo((b.getFunctionByIndex(i)));
                    if (func.module) {
                        this.imports.push({ base: func.base!, module: func.module!, type: "function" })
                    }
                }


                for (let i = 0; i < b.getNumGlobals(); ++i) {
                    const func = binaryen.getGlobalInfo((b.getGlobalByIndex(i)));
                    if (func.module) {
                        this.imports.push({ base: func.base!, module: func.module!, type: "global" })
                    }
                }


                for (let i = 0; i < b.getNumTables(); ++i) {
                    const func = binaryen.getTableInfo((b.getTableByIndex(i)));
                    if (func.module) {
                        this.imports.push({ base: func.base!, module: func.module!, type: "table" })
                    }
                }
            }
        }

        this.onWriteResolve();
        return {
            binaryen: b,
            //data: finalWasmContents,
            id: this.uniqueId,
            // path: this.finalFilePath
        }
    }

    getCppFileByPath(path: string) {
        let file = this.cppFilesByPath.get(path);
        if (!file) {
            debugger;
            throw new Error(`Internal error: missing c++ file at ${path}`);
        }
        return file;
    }

    exeNeedsRebuild = true;

    async loadCppFile(path: string, addWatchFile: (id: string) => void) {
        let ret: CppSourceFile;
        try {
            if (!this.cppFilesByPath.has(path)) {
                let fileContents = await readFile(path, "string");
                ret = new CppSourceFile(this, path, fileContents, this.parent.cppUniqueIdCounter++);
                let newWasmFile = ret.wasm;
                this.cppFilesByPath.set(path, ret);
                this.cppFilesById.set(ret.uniqueId, ret);
                this.wasmFilesByPath.set(ret.wasmPath, newWasmFile);
                this.wasmFilesById.set(newWasmFile.uniqueId, newWasmFile);
                this.parent.cppFilesById.set(ret.uniqueId, ret);
                this.parent.wasmFilesById.set(newWasmFile.uniqueId, newWasmFile);
                ret.cppNeedsReload = false;


            }
            else {
                // This path only happens during watch mode.
                ret = this.cppFilesByPath.get(path)!;
                //if (cppFile.cppNeedsReload) {
                //    cppFile.cppNeedsReload = false;
                let newContents = await readFile(path, "string");
                if (newContents != ret.contents || ret.includesDirty) {
                    ret.includesDirty = false;
                    // The source file has changed, 
                    // so we need to remake the file it compiles to
                    // (watch mode only)
                    ret.wasm.objNeedsRebuild = true;
                }
                ret.contents = newContents;
                //}
            }
        }
        catch (ex) {
            console.error(`A JS file imported a C++ file that does not exist: ${path}`);
            throw ex;
        }


        await ret.resolveIncludes(addWatchFile);
    }

    /*async loadWasmFile(cppFile: CppSourceFile) {
        console.assert(cppFile.wasm == null);
        cppFile.wasm.contents = await readFile(cppFile.wasmPath, "binary");
    }*/
}


class CppSourceFile {
    // Set to false once we've read the file, 
    // then true when the file changes (during watch), 
    // then false once we've read it again, etc.
    public cppNeedsReload = true;

    // This is set when we have detected a change to any #included file
    public includesDirty = true;

    includePaths = new Set<string>();

    async resolveIncludes(addWatchFile: (id: string) => void) {
        ((await runEmscripten("em++", "-E -H " + this.path + ` ${this.executionUnit.includePathsAsArgument} -o ` + this.includesPath)) as string);
        const b = await readFile(this.includesPath, "string");
        const includes = new Set<string>(b
            .split("\n")
            .map(line => {
                if (line.startsWith("#")) {
                    // Preprocessor would've removed this
                    const match = /^# ([0-9]+) (".+?")/.exec(line);
                    if (match) {
                        // Uh, is this, like, okay? Better ways to parse a string maybe? TODO maybe?
                        let includePath = JSON.parse(match[2]) as string;
                        if (!includePath.startsWith("<") && !(includePath == this.path)) {
                            includePath = normalizePath(includePath);
                            // No sense in adding hundreds of useless file watchers, exclude the standard libraries
                            if (!includePath.includes("emsdk/upstream/"))
                                return includePath;
                        }
                    }
                }
                return "";
            }).filter(include => !!include));


        includes.forEach(include => {
            MapOfSets.add(this.executionUnit.cppFilesByHeaderPath, normalizePath(include), this);
            addWatchFile(include);
        });
    }

    public wasm;
    constructor(public executionUnit: ExecutionUnit, public path: string, public contents: string, public uniqueId: number) {
        this.wasm = new WasmFile(this, this.wasmPath, this.executionUnit.parent.wasmUniqueIdCounter++);
    }

    get wasmPath() {
        let projectDir = cwd();
        return normalizePath(join(projectDir, `./temp/${this.uniqueId.toString(16).padStart(2, "0")}_${basename(this.path)}.wasm`));
    }

    get includesPath() {
        let projectDir = cwd();
        return normalizePath(join(projectDir, `./temp/${this.uniqueId.toString(16).padStart(2, "0")}_${basename(this.path)}.inc`));
    }

}

class WasmFile {
    public objNeedsRebuild = true;
    public contents: ArrayBuffer | null = null;
    constructor(public cppFile: CppSourceFile, public path: string, public uniqueId: number) { }
}


