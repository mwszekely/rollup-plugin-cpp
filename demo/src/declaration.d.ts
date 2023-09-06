
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

    /** Resolves when the other parts of this module are ready to be used. Do not use anything until this has resolved. */
    function __untilReady(): Promise<void>;
    /** The instantiation that provides all the other exports */
    const __instance: WebAssembly.Instance;
    /** The module that instantiate the current instance. */
    const __module: WebAssembly.Module;
    /** The memory object. Do not save the buffer &mdash; it can be invalidated when memory grows. */
    const __memory: WebAssembly.Memory;
    /** An alternative way to access the exports of this module. You can also import functions directly. */
    const __allExports: Record<string, unknown>;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeap(): ArrayBuffer;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapI8(): Int8Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapU8(): Uint8Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapI16(): Int16Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapU16(): Uint16Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapI32(): Int32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapU32(): Uint32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapI64(): BigInt64Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapU64(): BigUint64Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapF32(): Float32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    function __getHeapF64(): Float64Array;
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
