



let _b: any;

// It's weird like this because loading binaryen throws a lot of caught exceptions
// which are just annoying to debug around. So this delays it as long as possible.
export async function getBinaryen() {
    if (_b == null) {
        _b = import("binaryen");
    }
    return (await _b).default;
}
