# rollup-plugin-cpp

Ever wanted to just directly import C++ code from JS? "Of course not"?

This [Rollup](https://rollupjs.org/) plugin lets you write:

```C++
// ----------------------------
// foo.cpp

extern int externBar();
// No need to use EMSCRIPTEN_KEEPALIVE
extern "C" { int foo() { return externBar(); } }

// ----------------------------
// bar.cpp
int externBar() { return 626; }
```

```typescript
// ----------------------------
// index.ts

import { foo } from "./foo.cpp";
import "./bar.cpp"; // Just for linking

// Directly call the C++ function named "foo" and log its return value.
console.log(foo());
```

Wow! Talk about 🚀🚀🚀🌛💨🈲☣️🆖🆘🗿🕴️ (Okay but really this is just a proof of concept and will definitely break something/where/one. Alternatively, it's unlicensed into the public domain, scavenge what you like or just take it for yourself -- you, dear reader, could probably maintain this better than I would.)

## Details

When you import a `.c`, `.cc`, or `.cpp` file, this plugin invokes `em++` and compiles a binary for each file, replacing your `import { foo } from "*.cpp"` with `import { foo } from "final-exe.wasm"`, where "final-exe.wasm" is just a special placeholder for the final binary that combines them all together. When we finally get its contents, it's like that import is replaced with this:
```js
const module = await WebAssembly.instantiateStreaming(...);
export { foo } from module.exports;
```

The complexity of this plugin comes mostly from orchestrating all the different delays there are, not from actually compiling the code, which I found kind of surprising.

All imports also come with a few "helpers" exported under `$` (chosen because it's not a valid C identifier).

* `$.untilInstantiated()`: Resolves when the other parts of this module are ready to be used. Do not use anything until this has resolved.
* `$.getInstantiated()`: Synchronously returns `true` if the WASM module is ready and `false` if it isn't yet.
* `$.getHeap()`: Returns the current WASM memory. Do not save this &mdash; it can be invalidated when memory grows. It is a getter for a reason.
    * For `TypedArray` versions, see `getHeapI8`, `getHeapU8`, `getHeapI16`, `getHeapU16`, `getHeapI32`, `getHeapU32`, `getHeapI64`, `getHeapU64`, `getHeapF32`, &amp; `getHeapF64`.
* `$.instance`: The `WebAssembly.Instance` that provides all the other exports.
* `$.module`: The `WebAssembly.Module` that instantiated the current instance.
* `$.memory`: The ` WebAssembly.Memory` object. Do not save the buffer &mdash; it can be invalidated when memory grows.
* `$.allExports`: An alternative way to access the exports of this module. You can also import functions directly, which removes the need to add `EMSCRIPTEN_KEEPALIVE`.

 The `useTopLevelAwait` option can be used to emit a top-level await before the exports, but it may result in sub-optimal output (with the benefit of not needing to call `$.untilInstantiated`, to be clear).

```typescript
import { $, returnsAPointer } from "literally-any-cpp-source-file.cpp";

await $.untilInstantiated();
$.getHeapU8(returnsAPointer());

```

## Limitations

Yes.

But some notable ones:

* Emscripten needs to be installed globally, available on your system's PATH. [I'm not aware of any official NPM Emscripten ports](https://github.com/emscripten-core/emscripten/issues/5774).
* Embind causes mysterious linker errors due to missing imports in the final executable, even with the `-lembind` linker flag at every step. So everything's gotta be C-linkage and deal with simple parameters/return types. No exporting function overloads, templates, classes, etc. (though they can still be used, of course).
    * Instead of C-linkage, you can also do `__attribute__((export_name("MyExportedFunctionName")))`, but the simple types thing is still a problem. Exported templates will just never be a thing.
* The error reporting is real bad if there's a C++ syntax error or missing include file or other simple things like that. Sleuthing's required to figure out what goes wrong.
* No way to customize options passed to Emscripten yet (so no options to link with pre-built libraries, you gotta build 'em yourself).
* Basically the only parts of the WASI implemented are the bare essentials (the bits that'll get you `printf` and `assert` and `std::vector` and such). Anything else will probably fail to link.
* Some extra directories get added to your project root: `temp` (where we put `.inc` files, and individual `.obj` files), and `modules`, where the final compiled binary goes before being copied into the build directory by `Rollup` (as it needs somewhere to copy *from*).
* Auto-generating the Typescript declaration file for a given C++ file would most likely require a herculean amount of effort hooking into the Emscripten runtime, so it's all gotta be written out by hand.
* "Where's the debug dwarf sourcemap info to debug with source maps in the debugger"? Where is the debug sworce dwarfmap indeed.

## Non-limitations:

1. You don't need to use `EMSCRIPTEN_KEEPALIVE`, it's inferred from your imports because we have the names right there.
1. Compiles directly to WASM at all steps; it would theoretically be possible to swap `em++` out for `clang++` (but for Embind that will probably not be possible, if that ever happens).
1. Can run dead-code elimination on any C++ code you don't import, since the function names are specified when you import them.
1. Running in watch mode will correctly rebuild when you update a header file, not just the `.cpp` files you `import`
1. Create multiple independent modules with the `exe` search param:

```typescript
import { foo as foo1 } from "./foo.cpp?exe=mod1";
import { foo as foo2 } from "./foo.cpp?exe=mod2";
```
But it ruins Typescript's delicate wildcard module system that'll [hopefully improve at some point](https://github.com/microsoft/TypeScript/issues/38638)?



## Why.

Because I'm surprised I couldn't find something like this already. I figure there must be some inherent reason that something like this *shouldn't* exist and I'm on a quest to find it.

This is my list of Bad Consequences™ so far:

1. If a C/C++ project **requires** a build tool like CMake in order to build, it won't work. If each file can be compiled individually, as is usually the case for libraries, it will probably work fine though.
2. You gotta import every `.cpp` or `.c` source file individually. It's a bit of a pain but the linker will optimize out whatever isn't used, so it doesn't cause any bloat (aside from global/`static`/`thread_local` variables).
3. Bundling Javascript code is already on the sluggish side, and now we've gotta throw in C++ code compilation and optimization... Be sure to use watch mode as appropriate.
4. C/C++ code is likewise already notoriously finnicky to compile, so by not providing the pre-compiled WASM binary it's just another "it works fine on my machine" waiting to happen.

But also, see above for some of the non-limitations, because they're cool too.


## Visual Studio Code

To avoid the annoying red squiggles and actually have code completion in C++ files, make sure you have Emscripten in your include paths. You may also need to set `intelliSenseMode` and the various C++ standards flags.

`.vscode/c_cpp_properties.json`:
```json
{
    "configurations": [
        {
            [...]
            "includePath": [
                [...],
                "../emsdk/upstream/emscripten/system/include",
                [...],
            ],
            "intelliSenseMode": "clang-x86",
            [...]
        }
    ],
    "version": 4
}
```