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

All imports also come with a few "helpers", like `__untilReady`, `__module`, `__instance`, and `__memory`.  `__untilReady` in particular is needed because WASM instantiation is async (and top-level await has questionable support), and it has an __uglyName because those names are [guaranteed to never conflict with one of your named exports](https://en.cppreference.com/w/cpp/language/identifiers#In_declarations) (unless you like nose demons).  The `useTopLevelAwait` option can be used to emit a top-level await before the exports, but it may result in sub-optimal output (with the benefit of not needing to call `__untilReady`, to be clear).

```typescript
import { __untilReady, __module, __instance, __memory } from "literally-any-cpp-source-file.cpp"
```

## Limitations

Yes.

But some notable ones:

* Emscripten needs to be installed globally, available on your system's PATH. [I'm not aware of any official NPM Emscripten ports](https://github.com/emscripten-core/emscripten/issues/5774).
* Embind causes mysterious linker errors due to missing imports in the final executable, even with the `-lembind` linker flag at every step. So everything's gotta be C-linkage and deal with simple parameters/return types.
  * Instead of C-linkage, you can also do `__attribute__((export_name("MyExportedFunctionName")))`, but the simple types thing is still a problem.
* No way to customize options passed to Emscripten yet (so no options to link with pre-built libraries, you gotta build 'em yourself).
* Basically the only parts of the WASI implemented are the bare essentials (the bits that'll get you `printf` and `assert` and `std::vector` and such). Anything else will probably fail to link.
* Auto-generating the Typescript declaration file for a given C++ file would most likely require a herculean amount of effort hooking into the Emscripten runtime, so it's all gotta be written out by hand.
* "Where's the debug dwarf sourcemap info to debug with source maps in the debugger"? Where is the debug sworce dwarfmap indeed.

## Non-limitations:

1. You don't need to use `EMSCRIPTEN_KEEPALIVE`, it's inferred from your imports because we have the names right there.
1. Compiles directly to WASM at all steps; it would theoretically be possible to swap `em++` out for `clang++` (but for Embind that will probably not be possible, if that ever happens)
2. Can run dead-code elimination on any code you don't import, since the function names are specified when you import them.
3. Running in watch mode will correctly rebuild when you update a header file, not just the `.cpp` files you `import`
4. Create multiple independent modules with the `exe` search param:

```typescript
import { foo as foo1 } from "./foo.cpp?exe=mod1";
import { foo as foo2 } from "./foo.cpp?exe=mod2";
```
But it ruins Typescript's delicate wildcard module system that'll [hopefully improve at some point](https://github.com/microsoft/TypeScript/issues/38638)?



## Why.

Because I'm surprised I couldn't find something like this already. I figure there must be some inherent reason that something like this *shouldn't* exist and I'm on a quest to find it.

This is my list of Bad Consequences™ so far:

1. If a C/C++ project **requires** a build tool like CMake in order to build, it won't work. If each file can be compiled individually, as is usually the case, it will probably work fine though.
2. You gotta import every `.cpp` or `.c` source file individually. It's a bit of a pain but the linker will optimize out whatever isn't used, so it doesn't cause any bloat (aside from global/`static`/`thread_local` variables).
3. Bundling Javascript code is already on the sluggish side, and now we've gotta throw in C++ code compilation and optimization... Be sure to use watch mode as appropriate.
4. C/C++ code is already notoriously finnicky to compile, so by not providing the pre-compiled WASM binary it's just another "it works fine on my machine" waiting to happen.

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