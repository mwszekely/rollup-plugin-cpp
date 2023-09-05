
//declare namespace RollupPluginWasm {
    type PointerOpaque = number;
//}

declare module "*/helpers.cpp" {
    const __indirect_function_table: WebAssembly.Table;
    function __errno_location(...args: unknown[]): unknown;
    function emscripten_stack_get_free(...args: unknown[]): unknown;
    function emscripten_stack_get_base(...args: unknown[]): unknown;
    function emscripten_stack_get_end(...args: unknown[]): unknown;
    function stackSave(...args: unknown[]): unknown;
    function stackRestore(...args: unknown[]): unknown;
    function stackAlloc(...args: unknown[]): unknown;
    function emscripten_stack_get_current(...args: unknown[]): unknown;

    function __untilReady(): Promise<void>;
    const __instance: WebAssembly.Instance;
    const __module: WebAssembly.Module;
    const __memory: WebAssembly.Memory;
    const __allExports: Record<string, unknown>;
    function strLenS8(ptr: PointerOpaque): number;
    function strLenC8(ptr: PointerOpaque): number;
    function strLenC8N(ptr: PointerOpaque, maxLength: number): number;
    function strLenS16(ptr: PointerOpaque): number;
    function strLenC16(ptr: PointerOpaque): number;
    function strLenC16N(ptr: PointerOpaque, maxLength: number): number;
}


declare module "*/test.cpp" {
    function foo(): string;
    function bar2(): number;

}

/*
declare module "*.cpp" {
    // These are available from any C++ export (with ugly names to prevent collisions; collisions couldn't exist with these names without UB)
    function __untilReady(): Promise<void>;
    function __getInstance(): WebAssembly.Instance;
    function __getModule(): WebAssembly.Module;
}
*/
