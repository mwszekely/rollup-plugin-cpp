export interface CppMeta {
    /** Resolves when the other parts of this module are ready to be used. Do not use anything until this has resolved. */
    untilInstantiated(): Promise<void>;
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
    getHeapI8(): Int8Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU8(): Uint8Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI16(): Int16Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU16(): Uint16Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI32(): Int32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU32(): Uint32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapI64(): BigInt64Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapU64(): BigUint64Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapF32(): Float32Array;
    /** Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. */
    getHeapF64(): Float64Array;
    /** Synchronously returns `true` if the WASM module is ready and `false` if it isn't yet. */
    getInstantiated(): boolean;
}
