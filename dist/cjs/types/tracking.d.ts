import { PluginContext, RollupOptions } from "rollup";
export declare const HELPER_IMPORT_FINAL_WASM_0 = "\0__WASM_IMPORT_FINAL_";
export declare const HELPER_IMPORT_HANDLE_WASM_DATA = "\0__HELPER_IMPORT_HANDLE_WASM_DATA_";
export declare function funnyStartsWith<U extends string>(input: string, startsWith: U): input is `${U}${number}`;
export declare class ExecutionUnits {
    inputOptions: RollupOptions;
    buildMode: "debug" | "release";
    compilerOptions: {
        includePaths: string[];
    };
    executionUnitsByName: Map<string, ExecutionUnit>;
    cppFilesById: Map<number, CppSourceFile>;
    wasmFilesById: Map<number, WasmFile>;
    executionUnitsById: Map<number, ExecutionUnit>;
    context: PluginContext | null;
    cppUniqueIdCounter: number;
    exeUniqueIdCounter: number;
    wasmUniqueIdCounter: number;
    constructor(inputOptions: RollupOptions, buildMode: "debug" | "release", compilerOptions: {
        includePaths: string[];
    });
    getByUrl(path: string): ExecutionUnit;
    getById(id: `${typeof HELPER_IMPORT_FINAL_WASM_0}${number}` | number): ExecutionUnit;
    getByName(exe: string): ExecutionUnit;
    getCppFileById(id: number): CppSourceFile;
    getWasmFile(id: number): WasmFile;
}
export declare class ExecutionUnit {
    parent: ExecutionUnits;
    key: string;
    private cppFilesByPath;
    private cppFilesById;
    cppFilesByHeaderPath: Map<string, Set<CppSourceFile>>;
    private wasmFilesByPath;
    private wasmFilesById;
    flagsClang: string;
    flagsLinker: string;
    uniqueId: number;
    private onWriteResolve;
    onWritePromise: Promise<void>;
    private onWriteReject;
    constructor(parent: ExecutionUnits, key: string);
    imports: Array<{
        module: string;
        base: string;
        type: "function" | "global" | "table";
    }>;
    private importsFromJs;
    jsImportsAll(): void;
    /**
     * When the JS that imports a C++ files is parsed,
     * we examine the import to see the names of the functions (etc.) that are used
     * and store them by calling this member function.
     */
    addImportFromJs(str: string): void;
    get includePathsAsArgument(): string;
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
    compile(): Promise<{
        binaryen: any;
        id: number;
    }>;
    getCppFileByPath(path: string): CppSourceFile;
    exeNeedsRebuild: boolean;
    loadCppFile(path: string, addWatchFile: (id: string) => void): Promise<void>;
}
declare class CppSourceFile {
    executionUnit: ExecutionUnit;
    path: string;
    contents: string;
    uniqueId: number;
    cppNeedsReload: boolean;
    includesDirty: boolean;
    includePaths: Set<string>;
    resolveIncludes(addWatchFile: (id: string) => void): Promise<void>;
    wasm: WasmFile;
    constructor(executionUnit: ExecutionUnit, path: string, contents: string, uniqueId: number);
    get wasmPath(): string;
    get includesPath(): string;
}
declare class WasmFile {
    cppFile: CppSourceFile;
    path: string;
    uniqueId: number;
    objNeedsRebuild: boolean;
    contents: ArrayBuffer | null;
    constructor(cppFile: CppSourceFile, path: string, uniqueId: number);
}
export {};
