/* -*- indent-tabs-mode: nil; tab-width: 2; -*- */
/* vim: set ts=2 sw=2 et ai : */
/**
  Icquai: WebRTC peer-to-peer ephemeral chat in text and voice calls.
  Copyright (C) 2022. metastable-void and Menhera.org developers.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published
  by the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
  @file
*/

/**
 * @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel
 */

export const DEBUG = 'debug';
export const INFO = 'info';
export const WARN = 'warn';
export const ERROR = 'error';

export const objectToString = (value) => {
  switch (typeof value) {
    case 'bigint': {
      return String(value) + 'n';
    }
    case 'boolean': {
      return String(value);
    }
    case 'function': {
      return String(value);
    }
    case 'number': {
      return String(value);
    }
    case 'string': {
      return JSON.stringify(value);
    }
    case 'symbol': {
      return String(value);
    }
    case 'undefined': {
      return 'undefined';
    }
    case 'object': {
      if (null === value) {
        return 'null';
      }
      let toStringTag = 'Object';
      if (Array.isArray(value)) {
        toStringTag = 'Array';
      }
      if (Symbol.toStringTag in value) {
        toStringTag = String(value[Symbol.toStringTag]);
      }
      let content = '{ (unknown) }';
      try {
        content = JSON.stringify(value);
      } catch (e) {}
      return toStringTag + ' ' + content;
    }
  }
};

globalThis.objectToString = objectToString;

const zeroPadNumber = (n, digits) => {
  const pad = '0'.repeat(digits);
  const str = String(n);
  return pad.slice(str.length) + str;
};

const formatTime = (time = Date.now()) => {
  const date = new Date(time);
  const hours = zeroPadNumber(date.getHours(), 2);
  const minutes = zeroPadNumber(date.getHours(), 2);
  const seconds = zeroPadNumber(date.getSeconds(), 2);
  const milliseconds = zeroPadNumber(date.getMilliseconds(), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

/**
 * Log to console with the specified level.
 * @param {LogLevel} level 
 * @param {string} tag 
 * @param  {...any} args 
 */
export const logWithLevel = (level, tag, ... args) => {
  if (args.length < 1) {
    return;
  }
  tag = String(tag);
  let logging = console.log.bind(console);
  switch (level) {
    case 'debug': {
      logging = console.debug.bind(console);
      break;
    }
    case 'info': {
      logging = console.info.bind(console);
      break;
    }
    case 'warn': {
      logging = console.warn.bind(console);
      break;
    }
    case 'error': {
      logging = console.error.bind(console);
      break;
    }
  }
  if ('string' == typeof args[0]) {
    const dateStyle = `color: #888888`;
    const tagStyle = `color: #b777d5; font-weight: bold`;
    const textStyle = `color: unset; font-weight: unset`;
    args = [`%c%s %c[%s]%c ` + args[0], dateStyle, formatTime(), tagStyle, tag, textStyle, ... args.slice(1)];
  } else {
    args = [`%c%s %c[%s]%c`, dateStyle, formatTime(), tagStyle, tag, textStyle, ... args];
  }
  logging(... args);
};

export const debug = (tag, ... args) => {
  logWithLevel(DEBUG, tag, ... args);
};

export const info = (tag, ... args) => {
  logWithLevel(INFO, tag, ... args);
};

export const warn = (tag, ... args) => {
  logWithLevel(WARN, tag, ... args);
};

export const error = (tag, ... args) => {
  logWithLevel(ERROR, tag, ... args);
};

export class Console {
  #tag = '';
  constructor(tag = '') {
    if (!tag) {
      this.#tag = 'default';
    } else {
      this.#tag = String(tag).trim();
    }
  }

  debug(... args) {
    debug(this.#tag, ... args);
  }

  log(... args) {
    debug(this.#tag, ... args);
  }

  info(... args) {
    info(this.#tag, ... args);
  }

  warn(... args) {
    warn(this.#tag, ... args);
  }

  error(... args) {
    error(this.#tag, ... args);
  }

  get clear() {
    return console.clear.bind(console);
  }

  get assert() {
    return console.assert.bind(console);
  }
}
