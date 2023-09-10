'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginutils = require('@rollup/pluginutils');
var acornWalk = require('acorn-walk');
var basicEventWasi = require('basic-event-wasi');
var promises = require('fs/promises');
var MagicString = require('magic-string');
var path = require('path');
var child_process = require('child_process');
var mapAndSetExtensions = require('map-and-set-extensions');
var process$1 = require('process');
var readline = require('readline');
var wabtPromise = require('wabt');

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
async function runEmscripten(mode, args, opts = {}) {
    return runProgram(mode, `${args}`, opts);
}

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

//let parseWat!: Awaited<ReturnType<(typeof wabtPromise)>>["parseWat"];
let readWasm;
let awaitedWabt = false;
// TODO: top-level await........
let p = wabtPromise().then(w => {
    //    parseWat = w.parseWat;
    readWasm = w.readWasm;
    awaitedWabt = true;
});
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
            let exeUnitName = this.compilerOptions.defaultExeName || "default";
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
            this.executionUnitsByName.set(exe, new ExecutionUnit(this, exe, this.compilerOptions.memorySizes[exe] || 16777216));
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
    constructor(parent, key, memorySize) {
        this.parent = parent;
        this.key = key;
        this.memorySize = memorySize;
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
    get finalWasmPath() { return `modules/${this.key}.wasm`; }
    get finalWatPath() { return `modules/${this.key}.wat`; }
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
    async compile(writeWat) {
        if (!awaitedWabt)
            await p;
        await promises.mkdir(path.dirname(this.finalWasmPath), { recursive: true });
        let projectDir = process$1.cwd();
        const finalTempPath = path.relative(projectDir, this.finalWasmPath);
        const finalWatPath = path.relative(projectDir, this.finalWatPath);
        const argsExportedFunctions = this.importsFromJs == null ? "-sLINKABLE=1 -sEXPORT_ALL=2" :
            (this.importsFromJs.size ? `-sEXPORTED_FUNCTIONS=${[...this.importsFromJs].map(i => `_${i}`).join(",")}` : "");
        let argsShared = "--no-entry -fwasm-exceptions -sALLOW_MEMORY_GROWTH=1"; // -sSTANDALONE_WASM=1  // -sMINIMAL_RUNTIME=2
        let argsDebug = `-g -gdwarf-4 -gsource-map`;
        let argsRelease = `-flto -O3`;
        // Used for at both compile-time and link-time
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
                    let isCpp = !(path.toLowerCase().endsWith(".c"));
                    const emscriptenArgs = [
                        ...finalArgs,
                        isCpp ? "-std=c++20" : "-std=c2x",
                        "-c",
                        `-o ${cppFile.wasmPath}`,
                        path // The input path of the source file
                    ];
                    try {
                        await runEmscripten(isCpp ? "em++" : "emcc", emscriptenArgs.join(" "));
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
                    //const wabtData = readWasm(newData, { exceptions: true,  });
                    //const watData = wabtData.toText({ foldExprs: false, inlineExport: true });
                    //await writeFile(`${cppFile.watPath}`, watData, { encoding: "utf-8" });
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
                console.log(`${this.wasmFilesById.size == 1 ? "Rec" : "C"}ompiling ${this.wasmFilesById.size == 1 ? "the object file" : this.wasmFilesById.size == 2 ? "both object files together" : `all ${this.wasmFilesById.size} object files together`} into the final executable...`);
                const args = [
                    Array.from(this.wasmFilesById).map(([_id, wasm]) => wasm.path).join(" "),
                    `-o ${finalTempPath}`,
                    ...finalArgs,
                    argsExportedFunctions,
                ].join(" ");
                await runEmscripten("em++", `${args}`);
                //const finalWasmContents = await readFile(this.finalFilePath, "binary");
                //this.parent.context!.setAssetSource(this.fileReferenceId, finalWasmContents);
                const binaryen = await getBinaryen();
                const fileData = await readFile(finalTempPath, "binary");
                if (writeWat) {
                    const wabtData = readWasm(fileData, { exceptions: true });
                    const watData = wabtData.toText({ foldExprs: true, inlineExport: true });
                    await promises.writeFile(finalWatPath, watData, { encoding: "utf-8" });
                }
                b = binaryen.readBinary(fileData);
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
        (await runEmscripten("em++", "-E -H " + this.path + ` ${this.executionUnit.includePathsAsArgument} -o ` + this.includesPath));
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
    get basePath() {
        let projectDir = process$1.cwd();
        return pluginutils.normalizePath(path.join(projectDir, `./temp/${this.uniqueId.toString(16).padStart(2, "0")}_${path.basename(this.path)}`));
    }
    get wasmPath() {
        return `${this.basePath}.wasm`;
    }
    get watPath() {
        return `${this.basePath}.wat`;
    }
    get includesPath() {
        return `${this.basePath}.inc`;
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
function pluginCpp({ includePaths, buildMode, wasiLib, useTopLevelAwait, memorySizes, defaultExeName, noWat } = {}) {
    memorySizes !== null && memorySizes !== void 0 ? memorySizes : (memorySizes = {});
    includePaths || (includePaths = []);
    wasiLib || (wasiLib = "basic-event-wasi");
    buildMode || (buildMode = "release");
    useTopLevelAwait || (useTopLevelAwait = false);
    const writeWat = !noWat;
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
            allExeUnits !== null && allExeUnits !== void 0 ? allExeUnits : (allExeUnits = new ExecutionUnits(opts, buildMode, { includePaths: includePaths, memorySizes: memorySizes, defaultExeName: defaultExeName || "default" }));
            allExeUnits.inputOptions = opts;
            //await mkdir(join(projectDir, "modules"), { recursive: true });
            await promises.mkdir(path.join(projectDir, "temp"), { recursive: true });
            try {
                await runEmscripten("em++", "--version");
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
                //const knownWasi = ["proc_exit", "fd_write", "fd_close", "fd_seek", "fd_read", "environ_sizes_get", "environ_get"];
                //const knownEnv = ["__throw_exception_with_stack_trace"];
                const { wasi_snapshot_preview1: knownWasi, env: knownEnv } = basicEventWasi.KnownExports;
                return `
import {
${[...knownWasi, ...knownEnv].map(fname => `\t${fname}`).join(",\n")}
} from ${JSON.stringify(wasiLib)};

export default {
	wasi_snapshot_preview1: {
${knownWasi.map(fname => `\t\t${fname}, \t \t /** __@WASM_IMPORT_OMITTABLE__ **/`).join("\n")}
	},
	env: {
${knownEnv.map(fname => `\t\t${fname}, \t \t /** __@WASM_IMPORT_OMITTABLE__ **/`).join("\n")}
	}
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
import wasmResponse from ${JSON.stringify(`datafile:~/${executionUnit.finalWasmPath}`)};
import wasi from ${JSON.stringify(VMOD_THAT_EXPORTS_WASI_FUNCTIONS + executionUnit.uniqueId)}
import { instantiateWasi } from "basic-event-wasi"

/** @type {boolean} */
let instantiated = undefined;
/** @type {{Object.<string, any>}} */
let allExports;
/** @type {WebAssembly.Module} */
let module;
/** @type {WebAssembly.Instance} */
let instance;
/** @type {WebAssembly.Memory} */
let memory;

// This is a promise that resolves to the WASM module **before WASI is initialized**.
// WASI needs it to initialize itself; it shouldn't be used for any other purpose.
const { promise, resolve, reject } = Promise.withResolvers();

/**
 * Returns a promise that is fulfilled when the WASM module has been instantiated and its exports are ready to use.
 * 
 * This resolves at the same time that \`getInstantiated\` starts returning \`true\`. This is often the more preferable one to use. 
 */
async function untilInstantiated() {
	if (instantiated === undefined) {
		instantiated = false;
		const { wasiReady, imports } = instantiateWasi(promise, wasi);
		let resolved;
		if (globalThis.Response && wasmResponse instanceof globalThis.Response)
			resolved = await WebAssembly.instantiateStreaming(wasmResponse, { ...imports });
		else
			resolved = await WebAssembly.instantiate(wasmResponse, { ...imports });

		resolve(resolved);
		await wasiReady;

		module = resolved.module;
		instance = resolved.instance;
		allExports = resolved.instance.exports;
		memory = allExports.memory;
		allExports._initialize();
        instantiated = true;
	}
}

/**
 * Allows synchronously checking if the WASM module is instantiated yet. When \`false\`, no exports can be used.
 */
function getInstantiated() { return instantiated; }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. 
 */
function getHeap() { return memory.buffer; }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`char\`s, in this case) to reference.
 */
function getHeapI8(address = 0, count) { return new Int8Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (bytes, in this case) to reference.
 */
function getHeapU8(address = 0, count) { return new Uint8Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`short\`s, in this case) to reference.
 */
function getHeapI16(address = 0, count) { return new Int16Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`short\`s, in this case) to reference.
 */
function getHeapU16(address = 0, count) { return new Uint16Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`int\`s, in this case) to reference.
 */
function getHeapI32(address = 0, count) { return new Int32Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`int\`s, in this case) to reference.
 */
function getHeapU32(address = 0, count) { return new Uint32Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`long\`s, in this case) to reference.
 */
function getHeapI64(address = 0, count) { return new BigInt64Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`long\`s, in this case) to reference.
 */
function getHeapU64(address = 0, count) { return new BigUint64Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`float\`s, in this case) to reference.
 */
function getHeapF32(address = 0, count) { return new Float32Array(memory.buffer, address, count); }
/** 
 * Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows.
 * 
 * @param {number} [address] The byte-based address to start the array from.
 * @param {number} [count] The number of elements (\`double\`s, in this case) to reference.
 */
function getHeapF64(address = 0, count) { return new Float64Array(memory.buffer, address, count); }

${useTopLevelAwait ? `
await untilInstantiated();
` : ""}
export { 
	allExports, 
	memory, 
	instance, 
	module, 
	untilInstantiated,
    getInstantiated,
	getHeap,
	getHeapI8,
	getHeapU8,
	getHeapI16,
	getHeapU16,
	getHeapI32,
	getHeapU32,
	getHeapI64,
	getHeapU64,
	getHeapF32,
	getHeapF64
};
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
export * as $ from ${JSON.stringify(WASM_LOADER + executionUnit.uniqueId)};
export { 
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
                                    if (specifier.imported.name.startsWith("$"))
                                        return;
                                    if (specifier.imported.name == "_initialize")
                                        return;
                                    if (specifier.imported.name == "_start")
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
        generateBundle() {
            if (unhandledImports.size) {
                console.warn(`The following imports were unhandled and will likely cause errors at runtime`);
                console.warn([...unhandledImports].join(", "));
            }
        },
        async buildEnd() {
            // Write all the WASM modules
            await Promise.all([...allExeUnits.executionUnitsById].map(([_id, unit]) => { return unit.compile(writeWat); }));
        },
    };
}

exports.default = pluginCpp;
exports.pluginCpp = pluginCpp;
module.exports = Object.assign(exports.default, exports);
//# sourceMappingURL=index.js.map
