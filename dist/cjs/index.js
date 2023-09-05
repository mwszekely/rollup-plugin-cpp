'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginutils = require('@rollup/pluginutils');
var acornWalk = require('acorn-walk');
var promises = require('fs/promises');
var MagicString = require('magic-string');
var path = require('path');
var child_process = require('child_process');
var mapAndSetExtensions = require('map-and-set-extensions');
var process$1 = require('process');
var readline = require('readline');

let hasShownEmscriptenBanner = false;
async function runProgram(prog, args, { returnsStdout } = {}) {
    returnsStdout || (returnsStdout = false);
    let resolve;
    let reject;
    let promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    let allStdOut = new Array();
    const cb = (error, stdout, stderr) => {
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
                if (!hasShownEmscriptenBanner) {
                    hasShownEmscriptenBanner = true;
                    allStdOut.push(stdout);
                }
            }
            else {
                allStdOut.push(stdout);
            }
        }
    };
    let childProcess = child_process.exec(`${prog} ${args}`, cb);
    childProcess.on("close", (_code, signal) => {
        if (signal) {
            reject(signal);
        }
        else {
            resolve();
        }
    });
    const ret = await promise;
    if (returnsStdout)
        return allStdOut.join("\n");
    if (allStdOut.length)
        console.log(...allStdOut);
    return ret;
}
async function runEmscripten(args, opts = {}) {
    return runProgram("em++", `${args}`, opts);
}
/*
export async function runClang(args: string) {
    return runProgram("clang++", `${args} -fms-extensions -I "C:/Program Files (x86)/Windows Kits/10/Include/10.0.22621.0/ucrt" -I "C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.37.32822/include"`);
}

export async function runLoader(args: string) {
    return runProgram("wasm-ld", args);
}
*/

let _b;
// It's weird like this because loading binaryen throws a lot of caught exceptions
// which are just annoying to debug around. So this delays it as long as possible.
async function getBinaryen() {
    if (_b == null) {
        _b = import('binaryen');
    }
    return (await _b).default;
}

async function readFile(path, mode) {
    try {
        let ret;
        if (mode != "string")
            ret = await promises.readFile(path);
        else
            ret = await promises.readFile(path, { encoding: "utf-8" });
        return ret;
    }
    catch (ex) {
        throw ex;
    }
}
function getDatafilePlugin(options) {
    const datafilePluginName = 'rollup-plugin-datafile';
    if (Array.isArray(options.plugins)) {
        const parentPlugin = options.plugins.find(plugin => (plugin === null || plugin === void 0 ? void 0 : plugin.name) === datafilePluginName);
        return parentPlugin || null;
    }
    return null;
}

const HELPER_IMPORT_FINAL_WASM_0 = "\0__WASM_IMPORT_FINAL_";
// Basically just a wrapper around a Map<>
class ExecutionUnits {
    constructor(inputOptions, buildMode, compilerOptions) {
        this.inputOptions = inputOptions;
        this.buildMode = buildMode;
        this.compilerOptions = compilerOptions;
        this.executionUnitsByName = new Map();
        this.cppFilesById = new Map();
        this.wasmFilesById = new Map();
        this.executionUnitsById = new Map();
        this.context = null;
        this.cppUniqueIdCounter = 0;
        this.exeUniqueIdCounter = 0;
        this.wasmUniqueIdCounter = 0;
    }
    getByUrl(path) {
        if (path.includes(".c")) {
            let exeUnitName = "default";
            let url;
            try {
                url = new URL(`ext:${path}`);
            }
            catch (ex) {
                return undefined;
            }
            if (url.pathname.endsWith(".cpp") || url.pathname.endsWith(".c") || url.pathname.endsWith(".cc")) {
                if (url.searchParams.has("exe")) {
                    exeUnitName = url.searchParams.get("exe");
                }
                return this.getByName(exeUnitName);
            }
        }
        return undefined;
    }
    getById(id) {
        if (typeof id == "string" && id.startsWith(HELPER_IMPORT_FINAL_WASM_0))
            return this.getById(parseInt(id.substring(HELPER_IMPORT_FINAL_WASM_0.length)));
        console.assert(this.executionUnitsById.has(id));
        return this.executionUnitsById.get(id);
    }
    getByName(exe) {
        if (!this.executionUnitsByName.has(exe))
            this.executionUnitsByName.set(exe, new ExecutionUnit(this, exe));
        return this.executionUnitsByName.get(exe);
    }
    getCppFileById(id) {
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
    getWasmFile(id) {
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
class ExecutionUnit {
    constructor(parent, key) {
        this.parent = parent;
        this.key = key;
        this.cppFilesByPath = new Map();
        this.cppFilesById = new Map();
        this.cppFilesByHeaderPath = new Map();
        this.wasmFilesByPath = new Map();
        this.wasmFilesById = new Map();
        this.flagsClang = ""; // Used when compiling a C++ files to a WASM files
        this.flagsLinker = ""; // Used when linking multiple WASM files together
        //get outputTempWasmPath() { return `./temp/exe_${this.uniqueId}.wasm` }
        this.imports = [];
        // `null` indicates "export all"
        this.importsFromJs = new Set();
        this.exeNeedsRebuild = true;
        this.uniqueId = this.parent.exeUniqueIdCounter++;
        this.parent.executionUnitsById.set(this.uniqueId, this);
        this.onWritePromise = new Promise((resolve, _reject) => { this.onWriteResolve = resolve; this.onWriteReject = this.onWriteReject; });
    }
    jsImportsAll() { this.importsFromJs = null; }
    /**
     * When the JS that imports a C++ files is parsed,
     * we examine the import to see the names of the functions (etc.) that are used
     * and store them by calling this member function.
     */
    addImportFromJs(str) {
        var _a;
        (_a = this.importsFromJs) === null || _a === void 0 ? void 0 : _a.add(str);
    }
    get includePathsAsArgument() {
        return this.parent.compilerOptions.includePaths.map(includePath => `-I "${includePath}"`).join(" ");
    }
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
        const finalFilePath = `modules/${this.uniqueId}.wasm`;
        await promises.mkdir(path.dirname(finalFilePath), { recursive: true });
        let projectDir = process$1.cwd();
        const finalTempPath = path.relative(projectDir, finalFilePath);
        const argsExportedFunctions = this.importsFromJs == null ? "-sLINKABLE=1 -sEXPORT_ALL=2" :
            (this.importsFromJs.size ? `-sEXPORTED_FUNCTIONS=${[...this.importsFromJs].map(i => `_${i}`).join(",")}` : "");
        let argsShared = "--no-entry -std=c++20 -fwasm-exceptions"; // -sSTANDALONE_WASM=1  // -sMINIMAL_RUNTIME=2
        let argsDebug = `-g -gdwarf-4 -gsource-map`;
        let argsRelease = `-flto -O3`;
        const finalArgs = [
            this.includePathsAsArgument,
            argsShared,
            (this.parent.buildMode == "debug" ? argsDebug : argsRelease)
        ];
        let b;
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
                    const emscriptenArgs = [
                        ...finalArgs,
                        "-c",
                        `-o ${cppFile.wasmPath}`,
                        path // The input path of the source file
                    ];
                    try {
                        await runEmscripten(emscriptenArgs.join(" "));
                    }
                    catch (ex) {
                        process$1.stdout.write("\n");
                        console.log(ex);
                        process$1.stdout.write("\n");
                    }
                    readline.clearLine(process$1.stdout, 0);
                    readline.cursorTo(process$1.stdout, 0, undefined);
                    process$1.stdout.write(`Compiling to ${cppFile.wasm.path}...`);
                    const newData = await readFile(cppFile.wasm.path, "binary");
                    this.exeNeedsRebuild || (this.exeNeedsRebuild = cppFile.wasm.contents == null || (newData.compare(new Uint8Array(cppFile.wasm.contents)) != 0));
                    cppFile.wasm.contents = newData;
                    ++count;
                }
                else {
                    return Promise.resolve();
                }
            }));
            readline.clearLine(process$1.stdout, 0);
            readline.cursorTo(process$1.stdout, 0, undefined);
            process$1.stdout.write(`Compiled ${count}/${this.cppFilesByPath.size} source files.\n`);
            if (!this.exeNeedsRebuild) {
                console.log(`There were no changes to the individual .wasm files, so the final file does not need rebuilt.`);
            }
            else {
                this.exeNeedsRebuild = false;
                console.log(`Compiling all object files together into a the final executable...`);
                const args = [
                    Array.from(this.wasmFilesById).map(([_id, wasm]) => wasm.path).join(" "),
                    `-o ${finalTempPath}`,
                    ...finalArgs,
                    argsExportedFunctions,
                ].join(" ");
                await runEmscripten(`${args}`);
                //const finalWasmContents = await readFile(this.finalFilePath, "binary");
                //this.parent.context!.setAssetSource(this.fileReferenceId, finalWasmContents);
                const binaryen = await getBinaryen();
                b = binaryen.readBinary(await readFile(finalTempPath, "binary"));
                for (let i = 0; i < b.getNumFunctions(); ++i) {
                    const func = binaryen.getFunctionInfo((b.getFunctionByIndex(i)));
                    if (func.module) {
                        this.imports.push({ base: func.base, module: func.module, type: "function" });
                    }
                }
                for (let i = 0; i < b.getNumGlobals(); ++i) {
                    const func = binaryen.getGlobalInfo((b.getGlobalByIndex(i)));
                    if (func.module) {
                        this.imports.push({ base: func.base, module: func.module, type: "global" });
                    }
                }
                for (let i = 0; i < b.getNumTables(); ++i) {
                    const func = binaryen.getTableInfo((b.getTableByIndex(i)));
                    if (func.module) {
                        this.imports.push({ base: func.base, module: func.module, type: "table" });
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
        };
    }
    getCppFileByPath(path) {
        let file = this.cppFilesByPath.get(path);
        if (!file) {
            debugger;
            throw new Error(`Internal error: missing c++ file at ${path}`);
        }
        return file;
    }
    async loadCppFile(path, addWatchFile) {
        let ret;
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
                ret = this.cppFilesByPath.get(path);
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
}
class CppSourceFile {
    async resolveIncludes(addWatchFile) {
        (await runEmscripten("-E -H " + this.path + ` ${this.executionUnit.includePathsAsArgument} -o ` + this.includesPath));
        const b = await readFile(this.includesPath, "string");
        const includes = new Set(b
            .split("\n")
            .map(line => {
            if (line.startsWith("#")) {
                // Preprocessor would've removed this
                const match = /^# ([0-9]+) (".+?")/.exec(line);
                if (match) {
                    // Uh, is this, like, okay? Better ways to parse a string maybe? TODO maybe?
                    let includePath = JSON.parse(match[2]);
                    if (!includePath.startsWith("<") && !(includePath == this.path)) {
                        includePath = pluginutils.normalizePath(includePath);
                        // No sense in adding hundreds of useless file watchers, exclude the standard libraries
                        if (!includePath.includes("emsdk/upstream/"))
                            return includePath;
                    }
                }
            }
            return "";
        }).filter(include => !!include));
        includes.forEach(include => {
            mapAndSetExtensions.MapOfSets.add(this.executionUnit.cppFilesByHeaderPath, pluginutils.normalizePath(include), this);
            addWatchFile(include);
        });
    }
    constructor(executionUnit, path, contents, uniqueId) {
        this.executionUnit = executionUnit;
        this.path = path;
        this.contents = contents;
        this.uniqueId = uniqueId;
        // Set to false once we've read the file, 
        // then true when the file changes (during watch), 
        // then false once we've read it again, etc.
        this.cppNeedsReload = true;
        // This is set when we have detected a change to any #included file
        this.includesDirty = true;
        this.includePaths = new Set();
        this.wasm = new WasmFile(this, this.wasmPath, this.executionUnit.parent.wasmUniqueIdCounter++);
    }
    get wasmPath() {
        let projectDir = process$1.cwd();
        return pluginutils.normalizePath(path.join(projectDir, `./temp/${this.uniqueId.toString(16).padStart(2, "0")}_${path.basename(this.path)}.wasm`));
    }
    get includesPath() {
        let projectDir = process$1.cwd();
        return pluginutils.normalizePath(path.join(projectDir, `./temp/${this.uniqueId.toString(16).padStart(2, "0")}_${path.basename(this.path)}.inc`));
    }
}
class WasmFile {
    constructor(cppFile, path, uniqueId) {
        this.cppFile = cppFile;
        this.path = path;
        this.uniqueId = uniqueId;
        this.objNeedsRebuild = true;
        this.contents = null;
    }
}

const SyntheticModuleName = "wasm_module_";
async function filter(allExeUnits, id, func) {
    const executionUnit = allExeUnits.getByUrl(id);
    if (executionUnit) {
        return await func(executionUnit);
    }
}
/**
 * This outputs the exports of the WASI library
 * in a way that can be tree-shaken depending on what WASI functions
 * the C++ code actually uses.
 *
 * (i.e. it's the virtual module that includes the weird comments whose lines get `replaceAll`d out)
 *
 * TODO: This is also one per execution unit -- is that necessary? Seems unnecessary, given how WASI instantiation works.
 */
const VMOD_THAT_EXPORTS_WASI_FUNCTIONS = `\0C++_PLUGIN_WASI_`;
/**
 * This is a virtual module, or rather a series of virtual modules, one per execution unit.
 *
 * It's responsible for importing and instantiating the WASM module from its URL.
 */
const WASM_LOADER = `\0C++_PLUGIN_WASM_`;
function pluginCpp({ includePaths, buildMode, wasiLib, useTopLevelAwait } = {}) {
    includePaths || (includePaths = []);
    wasiLib || (wasiLib = "basic-event-wasi");
    buildMode || (buildMode = "release");
    useTopLevelAwait || (useTopLevelAwait = false);
    let projectDir = process.cwd();
    let allExeUnits = null;
    let options = null;
    // The key to this map is the name of the executable (empty string by default)
    //let exeInfo = new Map<string, { filesCpp: number[] }>();
    // The key to this map is the full path to the C++ file.
    //let cppFileInfo = new Map<number, { pathCpp: string, keyWasm: number, contentsCpp: string }>();
    // The key to this map
    //let wasmFileInfo = new Map<number, { pathWasm: string; contentsWasm: ArrayBuffer; }>();
    // This is a mapping of "path to CPP file" to "information about its compilation".
    //const mapOfThings = new Map<string, CppCompilationInfo>();
    let allImports = null;
    let unhandledImports = null;
    return {
        name: 'rollup-plugin-cpp',
        async buildStart(opts) {
            options = opts;
            allExeUnits !== null && allExeUnits !== void 0 ? allExeUnits : (allExeUnits = new ExecutionUnits(opts, buildMode, { includePaths: includePaths }));
            allExeUnits.inputOptions = opts;
            //await mkdir(join(projectDir, "modules"), { recursive: true });
            await promises.mkdir(path.join(projectDir, "temp"), { recursive: true });
            try {
                await runEmscripten("--version");
            }
            catch (ex) {
                console.log(`\n\n\nCannot compile C++ because Emscripten is not installed on your system (specifically, it is not available on this system's PATH). If you're on Windows, and you just installed Emscripten and are still seeing this error, you may need to log out to reset your PATH.\n\n\n`);
                throw ex;
            }
        },
        async watchChange(id) {
            // Watch for any changes in any of the header files any of our C++ source files include
            id = pluginutils.normalizePath(id);
            for (let [, exe] of allExeUnits.executionUnitsById) {
                const possiblyChangedCppFiles = exe.cppFilesByHeaderPath.get(id);
                if (possiblyChangedCppFiles) {
                    await Promise.all([...possiblyChangedCppFiles].map(cppFile => {
                        cppFile.includesDirty = true;
                        this.load({ id: cppFile.path, resolveDependencies: true });
                    }));
                }
            }
        },
        resolveId(id, importer) {
            allExeUnits.context = this;
            if (id.startsWith(WASM_LOADER))
                return id;
            if (id.startsWith(VMOD_THAT_EXPORTS_WASI_FUNCTIONS))
                return id;
            return filter(allExeUnits, id, executionUnit => {
                var _a;
                id = pluginutils.normalizePath(id);
                const datafilePluginApi = (_a = getDatafilePlugin(options)) === null || _a === void 0 ? void 0 : _a.api;
                datafilePluginApi === null || datafilePluginApi === void 0 ? void 0 : datafilePluginApi.promisesToWaitFor.add(executionUnit.onWritePromise);
                let fullPath = path.join(importer ? path.dirname(importer) : projectDir, id);
                return {
                    id: fullPath,
                    syntheticNamedExports: `${SyntheticModuleName}${executionUnit.uniqueId}`
                };
            });
        },
        async load(id) {
            if (id.startsWith(VMOD_THAT_EXPORTS_WASI_FUNCTIONS)) {
                const knownWasi = ["proc_exit", "fd_write", "fd_close", "fd_seek", "fd_read", "environ_sizes_get", "environ_get"];
                return `
import {
${knownWasi.map(fname => `\t${fname}`).join(",\n")}
} from ${JSON.stringify(wasiLib)};

export default {
${knownWasi.map(fname => `\t${fname},\t\t/** __@WASM_IMPORT_OMITTABLE__ **/`).join("\n")}
}
`;
            }
            if (id.startsWith(WASM_LOADER)) {
                const executionUnit = allExeUnits.getById(+id.substring(WASM_LOADER.length));
                // TODO: Want to import this from another file, but that's surprisingly difficult.
                // import.meta.url on Windows results in a path like "c:/c:/users/(...etc...)"
                // and I honestly have no clue how to normalize that in Node.
                return (`
// Import the WASM file from an external file, and wait on its response
import wasmResponse from ${JSON.stringify(`datafile:~/modules/${executionUnit.uniqueId}.wasm?mode=response`)};
import wasi_snapshot_preview1 from ${JSON.stringify(VMOD_THAT_EXPORTS_WASI_FUNCTIONS + executionUnit.uniqueId)}
import { instantiateWasi } from "basic-event-wasi"

let instantiated = false;
// An alias for instance.exports
let allExports;
// The module, once it's parsed from wasmResponse
let module;
// The instance created from the module parsed from wasmResponse
let instance;

// An ArrayBuffer representing the memory the current instance's module was compiled with and is currently running
// (Emscripten compiles with 0x1_00_00_00 bytes of memory by default)
let memory;

// This is a promise that resolves to the WASM module **before WASI is initialized**.
// WASI needs it to initialize itself; it shouldn't be used for any other purpose.
const { promise, resolve, reject } = Promise.withResolvers();

// Call this to wait until the wasmResponse has been fetched, parsed, and instantiated
// and, more importantly, allExports, module, and instance will have values.
async function untilReady() {
    if (!instantiated) {
        instantiated = true;
        const { wasiReady, imports } = instantiateWasi(promise, wasi_snapshot_preview1)
        let resolved = await WebAssembly.instantiateStreaming(wasmResponse, { ...imports });

        resolve(resolved);
        await wasiReady;
        
        module = resolved.module;
        instance = resolved.instance;
        allExports = resolved.instance.exports;
        memory = allExports.memory;
        allExports._initialize();
    }
}
${useTopLevelAwait ? "" : `
await untilReady();
`}
export { allExports, memory, instance, module, untilReady };
`);
            }
            return filter(allExeUnits, id, async (executionUnit) => {
                await executionUnit.loadCppFile(id, (include) => this.addWatchFile(pluginutils.normalizePath(include)));
                return { code: ";", moduleSideEffects: true };
            });
        },
        async transform(_code, id) {
            //const ids = [...this.getModuleIds()];
            //const mapped = ids.map(id => this.getModuleInfo(id));
            return filter(allExeUnits, id, async (executionUnit) => {
                let cppFile = executionUnit.getCppFileByPath(id);
                console.assert(cppFile);
                return {
                    //code: `export * from ${JSON.stringify(HELPER_IMPORT_WASM_ + cppFile.wasm!.uniqueId)}`,
                    code: `
export { 
    module as __module, 
    memory as __memory, 
    instance as __instance, 
    untilReady as __untilReady, 
    allExports as ${SyntheticModuleName}${executionUnit.uniqueId}
} from ${JSON.stringify(WASM_LOADER + executionUnit.uniqueId)}
`,
                    moduleSideEffects: true
                };
            });
        },
        async moduleParsed(info) {
            // Whenever we do "import { foo } from 'file.cpp';", we want to extract the "foo" identifiers
            // so that we know what exported options emscripten wants.
            // (The alternative is just exporting everything)
            if (info.ast) {
                acornWalk.simple(info.ast, {
                    ImportDeclaration: (n) => {
                        const node = n;
                        let exeUnit = allExeUnits.getByUrl((node).source.value);
                        if (exeUnit) {
                            node.specifiers.forEach(specifier => {
                                if (specifier.type == "ImportNamespaceSpecifier") {
                                    exeUnit.jsImportsAll();
                                }
                                if (specifier.type == "ImportDefaultSpecifier") {
                                    exeUnit.jsImportsAll();
                                }
                                else if (specifier.type == "ImportSpecifier") {
                                    if (specifier.imported.name.startsWith("__"))
                                        return;
                                    if (specifier.imported.name == "_initialize")
                                        return;
                                    exeUnit.addImportFromJs(specifier.imported.name);
                                }
                                else {
                                    debugger;
                                }
                            });
                        }
                    }
                });
            }
        },
        renderStart() {
            allImports = new Set();
            allExeUnits.executionUnitsById.forEach((i) => {
                i.imports.forEach(i => {
                    allImports.add(i.base);
                });
            });
            unhandledImports = new Set([...allImports]);
        },
        async renderChunk(code) {
            // This is where we take out the WASI imports we don't use
            const R = /\s+((?:[a-z]|[0-9]|_)+),?\s+\/\*\*\s+__@WASM_IMPORT_OMITTABLE__\s+\*\*\//g;
            // Still don't know if this is actually the best way to do this...?
            const s = new MagicString(code);
            s.replaceAll(R, (_whole, funcName) => {
                if (allImports.has(funcName)) {
                    unhandledImports.delete(funcName);
                    return `\n\t${funcName},`;
                }
                return `\n\t/* Omitted ${funcName} */`;
            });
            return {
                code: s.toString(),
                map: s.generateMap({ hires: true }), // ??? https://stackoverflow.com/questions/76186660/how-to-use-magicstring-to-provide-a-sourcemap-with-rollups-renderchunk-hook
            };
        },
        async buildEnd() {
            if (unhandledImports.size) {
                console.warn(`The following imports were unhandled and will likely cause errors at runtime`);
                console.warn([...unhandledImports].join(", "));
            }
            // Write all the WASM modules
            await Promise.all([...allExeUnits.executionUnitsById].map(([_id, unit]) => { return unit.compile(); }));
        },
    };
}

exports.default = pluginCpp;
module.exports = Object.assign(exports.default, exports);
//# sourceMappingURL=index.js.map
