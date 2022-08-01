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
