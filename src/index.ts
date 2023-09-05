import { normalizePath } from "@rollup/pluginutils";
import { simple } from "acorn-walk";
import { mkdir } from "fs/promises";
import MagicString from "magic-string";
import { dirname, join } from "path";
import { InputPluginOption, NormalizedInputOptions, SourceMapInput } from "rollup";
import { runEmscripten } from "./clang.js";
import { ExecutionUnit, ExecutionUnits } from "./tracking.js";
import { getDatafilePlugin } from "./util.js";

const SyntheticModuleName = "wasm_module_"

async function filter<T extends (executionUnit: ExecutionUnit) => any>(allExeUnits: ExecutionUnits, id: string, func: T) {
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

export interface PluginCppOptions {

    includePaths?: string[];

    buildMode?: "debug" | "release";

    wasiLib?: string;

    useTopLevelAwait?: boolean;
}

function pluginCpp({ includePaths, buildMode, wasiLib, useTopLevelAwait }: Partial<PluginCppOptions> = {}): InputPluginOption {
    includePaths ||= [];
    wasiLib ||= "basic-event-wasi";
    buildMode ||= "release";
    useTopLevelAwait ||= false;

    let projectDir = process.cwd();

    let allExeUnits: ExecutionUnits = null!;
    let options: NormalizedInputOptions = null!;

    // The key to this map is the name of the executable (empty string by default)
    //let exeInfo = new Map<string, { filesCpp: number[] }>();
    // The key to this map is the full path to the C++ file.
    //let cppFileInfo = new Map<number, { pathCpp: string, keyWasm: number, contentsCpp: string }>();
    // The key to this map
    //let wasmFileInfo = new Map<number, { pathWasm: string; contentsWasm: ArrayBuffer; }>();

    // This is a mapping of "path to CPP file" to "information about its compilation".
    //const mapOfThings = new Map<string, CppCompilationInfo>();

    let allImports: Set<string> | null = null;
    let unhandledImports: Set<string> | null = null;

    return {
        name: 'rollup-plugin-cpp', // this name will show up in logs and errors,
        async buildStart(opts) {
            options = opts;
            allExeUnits ??= new ExecutionUnits(opts, buildMode!, { includePaths: includePaths! });
            allExeUnits.inputOptions = opts;
            //await mkdir(join(projectDir, "modules"), { recursive: true });
            await mkdir(join(projectDir, "temp"), { recursive: true });
            try {
                await runEmscripten("--version");
            }
            catch (ex) {
                console.log(`\n\n\nCannot compile C++ because Emscripten is not installed on your system (specifically, it is not available on this system's PATH). If you're on Windows, and you just installed Emscripten and are still seeing this error, you may need to log out to reset your PATH.\n\n\n`)
                throw ex;
            }
        },
        async watchChange(id) {
            // Watch for any changes in any of the header files any of our C++ source files include
            id = normalizePath(id);
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

            if (id.startsWith(WASM_LOADER)) return id;
            if (id.startsWith(VMOD_THAT_EXPORTS_WASI_FUNCTIONS)) return id;

            return filter(allExeUnits, id, executionUnit => {
                id = normalizePath(id);
                const datafilePluginApi = getDatafilePlugin(options)?.api;


                datafilePluginApi?.promisesToWaitFor.add(executionUnit.onWritePromise);

                let fullPath = join(importer ? dirname(importer) : projectDir, id);

                return {
                    id: fullPath,
                    syntheticNamedExports: `${SyntheticModuleName}${executionUnit.uniqueId}`
                }
            });
        },
        async load(id) {

            if (id.startsWith(VMOD_THAT_EXPORTS_WASI_FUNCTIONS)) {

                const knownWasi = ["proc_exit", "fd_write", "fd_close", "fd_seek", "fd_read", "environ_sizes_get", "environ_get"];
                const knownEnv = ["__throw_exception_with_stack_trace"];

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
`
            }

            if (id.startsWith(WASM_LOADER)) {
                const executionUnit = allExeUnits.getById(+id.substring(WASM_LOADER.length));
                // TODO: Want to import this from another file, but that's surprisingly difficult.
                // import.meta.url on Windows results in a path like "c:/c:/users/(...etc...)"
                // and I honestly have no clue how to normalize that in Node.
                return (
                    `
// Import the WASM file from an external file, and wait on its response
import wasmResponse from ${JSON.stringify(`datafile:~/modules/${executionUnit.uniqueId}.wasm`)};
import wasi from ${JSON.stringify(VMOD_THAT_EXPORTS_WASI_FUNCTIONS + executionUnit.uniqueId)}
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
    }
}
${useTopLevelAwait? "" : `
await untilReady();
`}
export { allExports, memory, instance, module, untilReady };
`
                );
            }
            return filter(allExeUnits, id, async (executionUnit) => {

                await executionUnit.loadCppFile(id, (include) => this.addWatchFile(normalizePath(include)));
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
                }
            });

        },
        async moduleParsed(info) {
            // Whenever we do "import { foo } from 'file.cpp';", we want to extract the "foo" identifiers
            // so that we know what exported options emscripten wants.
            // (The alternative is just exporting everything)
            if (info.ast) {
                simple(info.ast!, {
                    ImportDeclaration: (n) => {
                        const node = (n as any as ImportDeclaration);

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
                            })
                        }
                    }
                })
            }

        },
        renderStart() {

            allImports = new Set<string>();
            allExeUnits.executionUnitsById.forEach((i) => {
                i.imports.forEach(i => {
                    allImports!.add(i.base);
                })
            })
            unhandledImports = new Set<string>([...allImports]);
        },
        async renderChunk(code) {

            // This is where we take out the WASI imports we don't use


            const R = /\s+((?:[a-z]|[0-9]|_)+),?\s+\/\*\*\s+__@WASM_IMPORT_OMITTABLE__\s+\*\*\//g;

            // Still don't know if this is actually the best way to do this...?
            const s = new MagicString(code);




            s.replaceAll(R, (_whole, funcName) => {
                if (allImports!.has(funcName)) {
                    unhandledImports!.delete(funcName);
                    return `\n\t${funcName},`;
                }
                return `\n\t/* Omitted ${funcName} */`
            });


            return {
                code: s.toString(),
                map: s.generateMap({ hires: true }) as SourceMapInput, // ??? https://stackoverflow.com/questions/76186660/how-to-use-magicstring-to-provide-a-sourcemap-with-rollups-renderchunk-hook
            }
        },
        generateBundle() {
            if (unhandledImports!.size) {
                console.warn(`The following imports were unhandled and will likely cause errors at runtime`);
                console.warn([...unhandledImports!].join(", "));
            }
        },
        async buildEnd() {
            // Write all the WASM modules
            await Promise.all([...allExeUnits.executionUnitsById].map(([_id, unit]) => { return unit.compile() }));

        },
    };
}
/*
function proc_exit(code: number) {
    debugger;
}
function fd_write(fd: number, iov, iovcnt, pnum) {
    debugger;
    console.log(fd);
    return 0;
}
function unused_func(...args) {
    debugger;
    console.log(...args);
}*/

interface ImportDeclaration {
    type: "ImportDeclaration";
    source: Literal;
    specifiers: Array<ImportDefaultSpecifier | ImportNamespaceSpecifier | ImportSpecifier>;
    start: number;
    end: number;
}

interface ImportNamespaceSpecifier {
    type: "ImportNamespaceSpecifier";
    start: number;
    end: number;
    local: Identifier;
}

interface ImportDefaultSpecifier {
    type: "ImportDefaultSpecifier";
    start: number;
    end: number;
    local: Identifier;
}

interface ImportSpecifier {
    type: "ImportSpecifier";
    start: number;
    end: number;
    imported: Identifier;
    local: Identifier;
}

interface Identifier {
    type: "Identifier"
    name: string;
    start: number;
    end: number;
}

interface Literal {
    type: "Literal";
    start: number;
    end: number;
    raw: string;
    value: string;
}




export default pluginCpp;