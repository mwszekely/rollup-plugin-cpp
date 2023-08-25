declare global {
    interface PromiseConstructor {
        withResolvers<T>(): {
            promise: Promise<T>;
            resolve: (value: T | PromiseLike<T>) => void;
            reject: (reason?: any) => void;
        };
    }
}

Promise.withResolvers ??= <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    let promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return {
        promise,
        resolve,
        reject,
    }
}
