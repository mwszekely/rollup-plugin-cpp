export type Pointer<T> = number & {
    _ptrType?: T;
};
export interface CppMeta {
    /** Resolves when the other parts of this module are ready to be used. Do not use anything until this has resolved. */
    untilInstantiated(): Promise<void>;
    /** Synchronously returns `true` if the WASM module is ready and `false` if it isn't yet. */
    getInstantiated(): boolean;
    /** The instantiation that provides all the other exports */
    instance: WebAssembly.Instance;
    /** The module that instantiate the current instance. */
    module: WebAssembly.Module;
    /** The memory object. Do not save the buffer &mdash; it can be invalidated when memory grows. */
    memory: WebAssembly.Memory;
    /** An alternative way to access the exports of this module. You can also import functions directly. */
    allExports: Record<string, unknown>;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeap(): ArrayBuffer;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI8(address?: Pointer<number>, count?: number): Int8Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU8(address?: Pointer<number>, count?: number): Uint8Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI16(address?: Pointer<number>, count?: number): Int16Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU16(address?: Pointer<number>, count?: number): Uint16Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI32(address?: Pointer<number>, count?: number): Int32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU32(address?: Pointer<number>, count?: number): Uint32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI64(address?: Pointer<number>, count?: number): BigInt64Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU64(address?: Pointer<number>, count?: number): BigUint64Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapF32(address?: Pointer<number>, count?: number): Float32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapF64(address?: Pointer<number>, count?: number): Float64Array;
}
