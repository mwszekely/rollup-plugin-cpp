
//declare namespace RollupPluginWasm {
    type PointerOpaque = number;
//}


declare module "*/helpers.wasm" {
    const $: CppMeta;
    function strLenC16(ptr: PointerOpaque): number;
    function strLenC16N(ptr: PointerOpaque, maxLength: number): number;
}

declare module "*/helpers.cpp" {
    // TODO:
    import type { CppMeta } from "rollup-plugin-cpp";
    const __indirect_function_table: WebAssembly.Table;
    function __errno_location(...args: unknown[]): unknown;
    function emscripten_stack_get_free(...args: unknown[]): unknown;
    function emscripten_stack_get_base(...args: unknown[]): unknown;
    function emscripten_stack_get_end(...args: unknown[]): unknown;
    function stackSave(...args: unknown[]): unknown;
    function stackRestore(...args: unknown[]): unknown;
    function stackAlloc(...args: unknown[]): unknown;
    function emscripten_stack_get_current(...args: unknown[]): unknown;
    const $: CppMeta;

    function strLenS8(ptr: PointerOpaque): number;
    function strLenC8(ptr: PointerOpaque): number;
    function strLenC8N(ptr: PointerOpaque, maxLength: number): number;
    function strLenS16(ptr: PointerOpaque): number;
    function strLenC16(ptr: PointerOpaque): number;
    function strLenC16N(ptr: PointerOpaque, maxLength: number): number;
}


declare module "*/test.wasm" {
    function foo(): string;
    function bar2(): number;
}

declare module "*/test.cpp" {
    function foo(): string;
    function bar2(): number;

}
