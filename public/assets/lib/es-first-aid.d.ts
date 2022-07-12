
interface Iterable<T> {
    [Symbol.iterator](): Iterator<T>;
}

type BufferSource = ArrayBuffer | ArrayBufferView;

type MaybePromise<T> = Promise<T> | T;

interface PromiseComposition<T> extends Promise<Iterable<T>> {
    promises: Promise<T>[];
    [Symbol.iterator]: () => IterableIterator<T>;
    results: () => Promise<T[]>;
    rejections: () => Promise<any[]>;
    fulfilled: <returnType>(callback: (result: T) => returnType) => PromiseComposition<returnType>;
    rejected: <returnType>(callback: (reason: any) => returnType) => PromiseComposition<returnType>;
}

interface SymbolObject {
    symbol: symbol;
}

interface FirstAid {
    VERSION: string;

    firstAid: FirstAid;

    constructor: new () => FirstAid;

    PromiseComposition: new <T>(... promises: MaybePromise<T>[]) => PromiseComposition<T>;

    // TypedArray constructor. (This is abstract; you cannot instantiate this.)
    TypedArray: Function;

    // Returns true if the passed value is a TypedArray.
    isTypedArray: (value: any) => boolean;

    // -0.
    MINUS_ZERO: number;

    // Creates a new null-prototype object.
    createNullPrototypeObject: () => {};

    // Wraps an object in a read-only Proxy.
    createReadOnlyProxy: <T>(obj: T) => T;

    // Returns true if the function throws.
    checkForError: (f: () => void) => boolean;

    // Returns true if the passed object is a revoked Proxy.
    // This function is no longer always-reliable due to changes made to ECMAScript specs.
    isRevokedProxy: (value: any) => boolean;

    // Returns true if the passed object has a valid [[Construct]] slot.
    isConstructor: (value: any) => boolean;

    // Converts a value into a 32-bit signed integer.
    toInt32: (value: any) => number;

    // Returns true if the passed value is a 32-bit signed integer.
    isInt32: (value: any) => boolean;

    // Tries to convert a value into an integer.
    toInt: (value: any) => number;

    // Returns true if the passed value is a valid safe integer in ECMAScript.
    isInt: (value: any) => boolean;

    // Returns true if the passed value is null.
    isNull: (value: any) => boolean;

    // Returns true if the passed value is an object. (This includes functions but not null.)
    isObject: (value: any) => boolean;

    // Returns true if the passed value is a valid property key (string or symbol).
    isPropertyKey: (value: any) => boolean;

    // Returns Unicode code points of the given string.
    getCodePoints: (str: string) => Iterable<number>;

    // Encodes a string into UTF-8 bytes.
    encodeString: (str: string) => Uint8Array;

    // Decodes a string from UTF-8 bytes.
    decodeString: (utf8Bytes: BufferSource) => string;

    // Converts a buffer or view into a Uint8Array.
    toUint8Array: (buffer: BufferSource) => Uint8Array;

    // Get a copied ArrayBuffer from BufferSource.
    getCopyBuffer: (buffer: BufferSource) => ArrayBuffer;

    // Encodes bytes into a hex string.
    encodeHex: (buffer: BufferSource) => string;

    // Decodes a hex string.
    decodeHex: (hexString: string) => Uint8Array;

    // Encodes bytes into Base-64 encoded string.
    encodeBase64: (buffer: BufferSource) => string;

    // Decodes a Base-64 encoded string.
    decodeBase64: (base64String: string) => Uint8Array;

    // Calculates a CRC-32 check sum of the given buffer. (Signed 32-bit integer)
    crc32: (buffer: BufferSource) => number;

    // Get the CRC-32 sum as a Uint8Array.
    crc32Bytes: (buffer: BufferSource) => Uint8Array;

    // Fills the given buffer with Math.random() values.
    randomFillInsecure: (buffer: BufferSource) => Uint8Array;

    // Fills the given buffer with secure random values.
    // Currently, Node.JS, Web, and Deno is supported.
    randomFill: (buffer: BufferSource) => Uint8Array;

    // Returns a random number in [0, 1) range.
    // Uses Math.random() if isInsecure is true.
    random: (isInsecure?: boolean) => number;

    // Returns a random number in (0, 1] range.
    // Uses Math.random() if isInsecure is true.
    randomNonZero: (isInsecure?: boolean) => number;

    // Returns a standard normal random number.
    // Uses Math.random() if isInsecure is true.
    randomNormal: (isInsecure?: boolean) => number;

    // Returns a standard exponential random number.
    // Uses Math.random() if isInsecure is true.
    randomExponential: (isInsecure?: boolean) => number;

    // Returns a Xenakis random number.
    // Uses Math.random() if isInsecure is true.
    randomXenakis: (isInsecure?: boolean) => number;

    // Returns true in the given probability.
    // Uses Math.random() if isInsecure is true.
    randomProb: (prob: number, isInsecure?: boolean) => boolean;

    // Generates a version-4 UUID string from the given buffer.
    getUuidFromBytes: (arr: BufferSource) => string;

    // Generates a random version-4 UUID string.
    // Uses Math.random() if isInsecure is true.
    getRandomUuid: (isInsecure?: boolean) => string;

    // Returns true if the given value is a valid UUID string.
    validateUuid: (uuid: string) => boolean;

    // Calls the given function in an asynchronous manner.
    callAsync: <argumentType, returnType>(callback: (... argumentsList: argumentType[]) => MaybePromise<returnType>, thisArgument: any, ... argumentList: argumentType[]) => Promise<returnType>;

    // Converts any value into a Promise.
    toPromise: <T>(value: MaybePromise<T>) => Promise<T>;

    // Returns a current Unix timestamp in milliseconds.
    getTime: () => number;

    // Encodes an object into JSON bytes.
    encodeJson: (value: any) => Uint8Array;

    // Decodes an object from JSON bytes.
    decodeJson: (bytes: BufferSource) => any;

    // Throws an error if assertion is false
    assert: (assertion: boolean, message?: string) => void;

    // Compare two values in a JSON-like manner
    compareJson: (a: any, b: any) => boolean;

    // Returns the passed object as a constructor.
    IdentityConstructor: new <T>(obj: T) => T;

    // Creates an object for a symbol.
    SymbolObject: new (symbol: symbol | SymbolObject) => SymbolObject;
}

declare const firstAid: FirstAid;
