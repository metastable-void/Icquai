// vim: ts=4 noet ai
// -*- tab-size: 4; indent-tabs-mode: t; -*-

/**
 * The ECMAScript First Aid (es-first-aid)
 * Copyright (C) 2021 Menhera.org
 * 
 * This file can be loaded as a normal script (Web or any),
 * or a CommonJS module, or an ECMAScript module.
 * 
 * This script assumes a modern ECMAScript environment as of 2020.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * @file
 */

'use strict'; // Since this can be loaded as a non-ES-module.
do {
	const MODULE_ID = '530b6b81-58ab-44cc-8212-ceb2c74ef1c5';
	if ('firstAid' in globalThis && globalThis.firstAid && globalThis.firstAid._MODULE_ID == MODULE_ID) {
		// Already loaded
		break;
	}

	const TypedArray = Reflect.getPrototypeOf(Uint8Array);

	const CRC32_TABLE = new Int32Array([
		0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f,
		0xe963a535, 0x9e6495a3,	0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988,
		0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
		0xf3b97148, 0x84be41de,	0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
		0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec,	0x14015c4f, 0x63066cd9,
		0xfa0f3d63, 0x8d080df5,	0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
		0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,	0x35b5a8fa, 0x42b2986c,
		0xdbbbc9d6, 0xacbcf940,	0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
		0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
		0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
		0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d,	0x76dc4190, 0x01db7106,
		0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
		0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d,
		0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e,
		0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
		0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
		0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7,
		0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
		0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa,
		0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
		0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
		0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a,
		0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 0xe3630b12, 0x94643b84,
		0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
		0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
		0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc,
		0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
		0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
		0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55,
		0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
		0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28,
		0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
		0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
		0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38,
		0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
		0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
		0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69,
		0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2,
		0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
		0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
		0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693,
		0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
		0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d
	]);

	const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

	let nodeCrypto;
	try {
		nodeCrypto = require('crypto');
	} catch (e) {}

	const FirstAid = function FirstAid () {
		if (!new.target) {
			throw new TypeError(`FirstAid constructor called without 'new'`);
		}
	};

	Reflect.defineProperty(FirstAid, Symbol.hasInstance, {
		value: function hasInstance (obj) {
			return obj && '_MODULE_ID' in obj && obj._MODULE_ID == MODULE_ID;
		},
	});

	const PromiseComposition = function PromiseComposition (... values) {
		if (!new.target) {
			throw new TypeError(`PromiseComposition constructor called without 'new'`);
		}

		const promises = values.map((value) => Promise.resolve(value));
		Object.freeze(promises);

		const allSettled = Promise.allSettled(promises);
		const _this = Reflect.construct(Promise, [(resolve, reject) => {
			allSettled.then((results) => resolve(results));
		}], new.target);

		Reflect.defineProperty(_this, 'promises', {value: promises});
		return _this;
	};

	PromiseComposition.prototype = Object.create(Promise.prototype);
	PromiseComposition.prototype.constructor = PromiseComposition;

	PromiseComposition.prototype.rejections = function rejections () {
		if (!(this instanceof PromiseComposition)) {
			throw new TypeError('PromiseComposition.rejections called on an object not implementing PromiseComposition');
		}
		return new Promise((resolve, reject) => {
			this.then((results) => void resolve(
				results.filter(result => 'rejected' == result.status)
				.map(result => result.reason)
			));
		});
	};

	PromiseComposition.prototype.results = function results () {
		if (!(this instanceof PromiseComposition)) {
			throw new TypeError('PromiseComposition.results called on an object not implementing PromiseComposition');
		}
		return new Promise((resolve, reject) => {
			this.then((results) => void resolve(
				results.filter(result => 'fulfilled' == result.status)
				.map(result => result.value)
			));
		});
	};

	PromiseComposition.prototype.fulfilled = function fulfilled (callback) {
		if (!(this instanceof PromiseComposition)) {
			throw new TypeError('PromiseComposition.fulfilled called on an object not implementing PromiseComposition');
		}
		if ('function' != typeof callback) {
			throw new TypeError('Callback must be a function');
		}

		return new PromiseComposition(
			... [... this.promises]
			.map((value) => Promise.resolve(value))
			.map((promise) => promise.then((value) => callback(value)))
		);
	};

	PromiseComposition.prototype.rejected = function rejected (callback) {
		if (!(this instanceof PromiseComposition)) {
			throw new TypeError('PromiseComposition.rejected called on an object not implementing PromiseComposition');
		}
		if ('function' != typeof callback) {
			throw new TypeError('Callback must be a function');
		}

		return new PromiseComposition(
			... [... this.promises]
			.map((value) => Promise.resolve(value))
			.map((promise) => promise.catch((value) => callback(value)))
		);
	};

	PromiseComposition.prototype[Symbol.iterator] = function getIterator () {
		if (!(this instanceof PromiseComposition)) {
			throw new TypeError('PromiseComposition.rejected called on an object not implementing PromiseComposition');
		}
		return [... this.promises].values();
	};

	/**
	 * The First Aid global object (module).
	 * @global
	 */
	const firstAid = FirstAid.prototype = {
		__proto__: null,

		// private
		_MODULE_ID: MODULE_ID,

		VERSION: '1.5.0',

		get firstAid() {
			return this;
		},

		constructor: FirstAid,

		PromiseComposition: PromiseComposition,

		TypedArray: TypedArray,

		isTypedArray: (value) => value instanceof firstAid.TypedArray,

		MINUS_ZERO: -0,

		/**
		 * Creates a new null-prototype object.
		 * @returns {object}
		 */
		createNullPrototypeObject: () => Object.create(null),

		/**
		 * Wrap an object in a read-only Proxy.
		 * @template T
		 * @param obj {T} an object to wrap in a proxy.
		 * @returns {T} a new Proxy.
		 */
		createReadOnlyProxy: (obj) => new Proxy(obj, {
			set: () => false,
			defineProperty: () => false,
			ownKeys: () => [],
			preventExtensions: () => false,
			setPrototypeOf: () => false,
		}),

		checkForError: (f) => {
			if ('function' != typeof f) {
				throw new TypeError('Not a function');
			}
			try {
				f();
				return false;
			} catch (e) {
				return true;
			}
		},

		/**
		 * Check if a value is a revoked Proxy.
		 * @param {*} a 
		 * @returns {boolean}
		 */
		isRevokedProxy: (a) => {
			try {
				new Proxy(a, {});

				try {
					a[Symbol()];
				} catch (e) {
					Reflect.getPrototypeOf(a);
				}
				
				return false;
			} catch (e) {
				return ('function' == typeof a || a && 'object' == typeof a);
			}
		},

		isConstructor: (f) => {
			try {
				Reflect.construct(String, [], f);
				return true;
			} catch (e) {
				return false;
			}
		},

		toInt32: (n) => 0 | n,

		isInt32: (n) => Object.is(n, 0 | n),

		toInt: (n) => Math.min(Number.MAX_SAFE_INTEGER, Math.max(Number.MIN_SAFE_INTEGER, Math.trunc(n))),

		isInt: (n) => n === Math.trunc(n) && Number.MAX_SAFE_INTEGER >= n && Number.MIN_SAFE_INTEGER <= n,

		isNull: (a) => null === a,

		isObject: (a) => 'function' == typeof a || 'object' == typeof a && null !== a,
		
		isPropertyKey: (a) => 'string' == typeof a || 'symbol' == typeof a,

		getCodePoints: function* (str) {
			const string = String(str);
			let i = 0;
			while (i < string.length) {
				const codePoint = string.codePointAt(i);
				yield codePoint;
				if (0xffff < codePoint) {
					i += 2;
				} else {
					i += 1;
				}
			}
		},

		// TODO: Throw on invalid surrogate pair
		encodeString: (str) => new Uint8Array(function* () {
			for (const codePoint of firstAid.getCodePoints(str)) {
				if (codePoint <= 0x7f) {
					yield codePoint;
				} else if (codePoint <= 0x7ff) {
					yield 0b11000000 | (codePoint >> 6);
					yield 0b10000000 | (0b111111 & codePoint);
				} else if (codePoint <= 0xffff) {
					yield 0b11100000 | (codePoint >> 12);
					yield 0b10000000 | (0b111111 & (codePoint >> 6));
					yield 0b10000000 | (0b111111 & codePoint);
				} else {
					yield 0b11110000 | (codePoint >> 18);
					yield 0b10000000 | (0b111111 & (codePoint >> 12));
					yield 0b10000000 | (0b111111 & (codePoint >> 6));
					yield 0b10000000 | (0b111111 & codePoint);
				}
			}
		}()),

		// TODO: Throw on invalid surrogate pair
		decodeString: (buffer) => String.fromCodePoint(... function* () {
			const bytes = firstAid.toUint8Array(buffer);
			let i = 0;
			while (i < bytes.length) {
				if (0 == (bytes[i] >> 7)) {
					yield bytes[i];
					i += 1;
				} else if (0b110 == (bytes[i] >> 5)) {
					if (0b10 != (bytes[i + 1] >> 6)) throw new TypeError('Invalid UTF-8 sequence');
					yield ((0b11111 & bytes[i]) << 6) | (0b111111 & bytes[i + 1]);
					i += 2;
				} else if (0b1110 == (bytes[i] >> 4)) {
					if (0b10 != (bytes[i + 1] >> 6)) throw new TypeError('Invalid UTF-8 sequence');
					if (0b10 != (bytes[i + 2] >> 6)) throw new TypeError('Invalid UTF-8 sequence');
					yield ((0b1111 & bytes[i]) << 12) | ((0b111111 & bytes[i + 1]) << 6) | (0b111111 & bytes[i + 2]);
					i += 3;
				} else if (0b11110 == (bytes[i] >> 3)) {
					if (0b10 != (bytes[i + 1] >> 6)) throw new TypeError('Invalid UTF-8 sequence');
					if (0b10 != (bytes[i + 2] >> 6)) throw new TypeError('Invalid UTF-8 sequence');
					if (0b10 != (bytes[i + 3] >> 6)) throw new TypeError('Invalid UTF-8 sequence');
					yield ((0b111 & bytes[i]) << 18) | ((0b111111 & bytes[i + 1]) << 12) | ((0b111111 & bytes[i + 2]) << 6) | (0b111111 & bytes[i + 3]);
					i += 4;
				} else {
					throw new TypeError('Invalid UTF-8 sequence');
				}
			}
		}()),

		/**
		 * Converts a buffer or view into a Uint8Array.
		 * @param {Uint8Array | ArrayBuffer | DataView} buffer 
		 * @returns {Uint8Array}
		 */
		toUint8Array: (buffer) => {
			let bytes;
			if (buffer instanceof ArrayBuffer) {
				bytes = new Uint8Array(buffer);
			} else if (buffer instanceof TypedArray || buffer instanceof DataView) {
				bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			} else {
				throw new TypeError('Not a buffer');
			}
			return bytes;
		},

		getCopyBuffer: (buffer) => {
			const bytes = firstAid.toUint8Array(buffer);
			return bytes.slice(0).buffer;
		},

		/**
		 * Encodes bytes into a hex string.
		 * @param {Uint8Array | ArrayBuffer | DataView} buffer 
		 * @returns {string}
		 */
		encodeHex: (buffer) => Array.prototype.map.call(
			firstAid.toUint8Array(buffer)
			,byte => (0x100 | byte).toString(0x10).slice(-2)
		).join(''),

		/**
		 * Decodes a hex string into a Uint8Array.
		 * @param {string} hex 
		 * @returns {Uint8Array}
		 */
		decodeHex: (hex) => {
			if ('string' != typeof hex) throw new TypeError('Not a string');
			if (hex.length & 1) throw new TypeError('Invalid length');
			if (hex.includes('.')) throw new TypeError('Invalid hex string');
			return new Uint8Array(function* () {
				for (let i = 0; i < (hex.length >>> 1); i++) {
					const byteHex = hex.substr(i << 1, 2).trim();
					if (byteHex.length != 2) {
						throw new TypeError('Invalid hex string');
					}
					const byte = Number('0x' + byteHex);
					if (isNaN(byte)) {
						throw new TypeError('Invalid hex string');
					}
					yield byte;
				}
			}());
		},

		encodeBase64: (buffer) => {
			const bytes = firstAid.toUint8Array(buffer);
			let result = '';
			let i = 0;
			const paddingLength = bytes.length % 3;
			while (i < bytes.length) {
				const a = bytes[i++];
				const b = 0 | bytes[i++];
				const c = 0 | bytes[i++];
				const bits = (a << 16) | (b << 8) | c;
				result += base64Chars.charAt(bits >> 18 & 0b111111)
					+ base64Chars.charAt(bits >> 12 & 0b111111)
                	+ base64Chars.charAt(bits >> 6 & 0b111111)
					+ base64Chars.charAt(bits & 0b111111);
			}
			return paddingLength ? result.slice(0, paddingLength - 3) + '==='.slice(paddingLength) : result;
		},

		decodeBase64: (str) => new Uint8Array(function* () {
			let string = String(str).replace(/[\t\n\f\r ]+/g, '');
			string += '=='.slice(2 - (string.length & 3));
			let i = 0;
			while (i < string.length) {
				const a = base64Chars.indexOf(string.charAt(i++));
				const b = base64Chars.indexOf(string.charAt(i++));
				const c = base64Chars.indexOf(string.charAt(i++));
				const d = base64Chars.indexOf(string.charAt(i++));
				if (a < 0 || b < 0 || c < 0 || d < 0 || a == 64 || b == 64) {
					throw new TypeError('Invalid base-64 string');
				}
				const bits = a << 18 | b << 12 | c << 6 | d;
				if (c == 64) {
					yield bits >> 16 & 0xff;
				} else if (d == 64) {
					yield bits >> 16 & 0xff;
					yield bits >> 8 & 0xff;
				} else {
					yield bits >> 16 & 0xff;
					yield bits >> 8 & 0xff;
					yield bits & 0xff;
				}
			}
		}()),

		crc32: (buffer) => {
			//
			const p = firstAid.toUint8Array(buffer);
			let crc = -1 | 0;
			for (let i = 0; i < p.length; ++i) {
				crc = (crc >>> 8) ^ CRC32_TABLE[0xff & (crc ^ p[i])];
			}
			return crc ^ -1;
		},

		crc32Bytes: (buffer) => {
			const view = new DataView(new ArrayBuffer(4));
			view.setInt32(0, firstAid.crc32(buffer), false);
			return firstAid.toUint8Array(view);
		},

		randomFillInsecure: (buffer) => {
			const bytes = firstAid.toUint8Array(buffer);
			for (let i = 0; i < bytes.length; i++) {
				bytes[i] = (Math.random() * 256) & 255;
			}
			return bytes;
		},

		randomFill: (buffer) => {
			const bytes = firstAid.toUint8Array(buffer);
			if ('object' == typeof crypto && crypto && 'function' == typeof crypto.getRandomValues) {
				crypto.getRandomValues(bytes);
			} else if (nodeCrypto && 'function' == typeof nodeCrypto.randomFillSync) {
				nodeCrypto.randomFillSync(bytes);
			} else {
				throw new Error('No secure randomness source available');
			}
			return bytes;
		},

		random: (isInsecure) => {
			if (isInsecure) return Math.random();
			const buffer = new ArrayBuffer(8);
			const bytes = new Uint8Array(buffer);
			firstAid.randomFill(bytes);
			bytes[0] = 0b00111111;
			bytes[1] = 0b11110000 | 0b00001111 & bytes[1];
			return (new DataView(buffer)).getFloat64(0, false) - 1;
		},

		// Random number in (0, 1].
		randomNonZero: (isInsecure) => {
			let a;
			do {
				// This loop should execute only once since we are using (1 - [random number in [0, 1)]).
				a = 1 - firstAid.random(isInsecure);
			} while (a === 0);
			return a;
		},

		randomNormal: (isInsecure) => {
			const a = firstAid.randomNonZero(isInsecure);
			const b = firstAid.random(isInsecure);
			return Math.sqrt(-2 * Math.log(a)) * Math.sin(2 * Math.PI * b);
		},

		randomExponential: (isInsecure) => -Math.log(firstAid.randomNonZero(isInsecure)),

		randomXenakis: (isInsecure) => 1 - Math.sqrt(firstAid.random(isInsecure)),

		randomProb: (prob, isInsecure) => firstAid.random(isInsecure) < prob,

		getUuidFromBytes: (arr) => {
			const bytes = firstAid.toUint8Array(arr).subarray(0, 16);
			if (16 != bytes.length) {
				throw new TypeError('Insufficient buffer length');
			}
			bytes[6] = bytes[6] & 0x0f ^ 0x40;
			bytes[8] = bytes[8] & 0x3f ^ 0x80;
			const hex = firstAid.encodeHex(bytes);
			return [
				hex.substr(0, 8),
				hex.substr(8, 4),
				hex.substr(12, 4),
				hex.substr(16, 4),
				hex.substr(20, 12),
			].join('-');
		},

		getRandomUuid: (isInsecure) => {
			const bytes = new Uint8Array(16);
			if (isInsecure) {
				firstAid.randomFillInsecure(bytes);
			} else {
				firstAid.randomFill(bytes);
			}
			return firstAid.getUuidFromBytes(bytes);
		},

		validateUuid: (uuid) => !!String(uuid).match(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		),

		callAsync: (callback, thisArg, ... args) => Promise.resolve().then(
			() => Reflect.apply(callback, thisArg || null, args)
		),

		toPromise: async (value) => await value,

		getTime: () => +new Date,

		encodeJson: (obj) => firstAid.encodeString(JSON.stringify(obj)),

		decodeJson: (bytes) => JSON.parse(firstAid.decodeString(bytes)),

		assert: (assertion, message) => {
			if (assertion) {
				return;
			}
			let error = new Error('Assertion failed');
			try {
				if (!message) throw void 0;
				error = new Error('Assertion failed: ' + message);
			} finally {
				throw error;
			}
		},

		compareJson: (a, b) => {
			function equals(a, b, aVisitedA, aVisitedB) {
				if (null !== a && 'object' == typeof a && !('toJSON' in a)) {
					try {
						const json = JSON.stringify(a);
						const value = JSON.parse(json);
						if ('object' != typeof value) {
							return equals(value, b, aVisitedA, aVisitedB);
						}
					} catch (e) {}
				}
				if (null !== b && 'object' == typeof b && !('toJSON' in b)) {
					try {
						const json = JSON.stringify(b);
						const value = JSON.parse(json);
						if ('object' != typeof value) {
							return equals(a, value, aVisitedA, aVisitedB);
						}
					} catch (e) {}
				}
				if (typeof a != typeof b) {
					return false;
				} else if ('number' == typeof a) {
					return Object.is(a, b);
				} else if (a === b) {
					return true;
				} else if (null === a || null === b || 'object' != typeof a) {
					return false;
				}
				const visitedA = Array.isArray(aVisitedA) ? aVisitedA : [];
				const visitedB = Array.isArray(aVisitedB) ? aVisitedB : [];
				if (visitedA.includes(a) || visitedB.includes(b)) {
					if (visitedA.indexOf(a) == visitedB.indexOf(b)) {
						return true;
					}
					return false;
				}
				visitedA.push(a);
				visitedB.push(b);
				let result = false;
				objectComaprison: {
					if (Array.isArray(a)) {
						if (!Array.isArray(b)) {
							result = false;
							break objectComaprison;
						}
						if (a.length != b.length) {
							result = false;
							break objectComaprison;
						}
						for (let i = 0; i < a.length; i++) {
							if (!equals(a[i], b[i], visitedA, visitedB)) {
								result = false;
								break objectComaprison;
							}
						}
						result = true;
						break objectComaprison;
					} else {
						const a_props = Object.getOwnPropertyNames(a).sort();
						const b_props = Object.getOwnPropertyNames(b).sort();
						if (a_props.length != b_props.length) {
							result = false;
							break objectComaprison;
						}
						for (let i = 0; i < a_props.length; i++) {
							const a_prop = a_props[i];
							const b_prop = b_props[i];
							if (a_prop != b_prop) {
								result = false;
								break objectComaprison;
							}
							if (!equals(a[a_prop], b[b_prop], visitedA, visitedB)) {
								result = false;
								break objectComaprison;
							}
						}
						result = true;
						break objectComaprison;
					}
				}
				visitedA.pop();
				visitedB.pop();
				return result;
			}
			return equals(a, b);
		},

		IdentityConstructor: function IdentityConstructor(obj) {
			if (!new.target) {
				return new IdentityConstructor(obj);
			}
			if (!firstAid.isObject(obj)) {
				throw new TypeError('Not an object');
			}
			return obj;
		},

		SymbolObject: function () {
			const objects = Object.create(null);
			const constructor = function SymbolObject(symbol) {
				if (!new.target) {
					return new SymbolObject(symbol);
				}
				if (symbol instanceof SymbolObject) {
					return symbol;
				}
				if ('symbol' != typeof symbol) {
					throw new TypeError('Not a Symbol');
				}
				if (objects[symbol]) {
					return objects[symbol];
				}
				const obj = Object.create(SymbolObject.prototype);
				Reflect.defineProperty(obj, 'symbol', {value: symbol});
				objects[symbol] = obj;
				return obj;
			};
			Reflect.defineProperty(constructor, Symbol.hasInstance, {value: ((obj) => firstAid.isObject(obj)
				&& 'symbol' == typeof obj.symbol && objects[obj.symbol] == obj)});
			return constructor;
		}(),
	};

	/* Module finalization */
	Object.freeze(firstAid);

	const firstAidInstance = new FirstAid;
	Reflect.defineProperty(globalThis, 'firstAid', {get: () => firstAidInstance.firstAid});
} while (false);
