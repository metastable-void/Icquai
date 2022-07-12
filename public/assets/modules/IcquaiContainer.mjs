// vim: ts=2 sw=2 et ai
/*
  Icquai: WebRTC peer-to-peer ephemeral chat in text and voice calls.
  Copyright (C) 2021. metastable-void and Menhera.org developers.

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
*/

/*
  Icquai Message Container Specification, version 1:
  {
    icquai_msg_version: int (== 1), // will be 2 in next version and so on...
    icquai_msg_type: string, // MSG_TYPE
    icquai_msg_payload: object, // any, specified for each MSG_TYPE
    icquai_msg_signed: 
  }
*/

/*
  MSG_TYPE:
  - If MSG_TYPE's first letter is in lower case, it must be signed.
  - If MSG_TYPE's second letter is in lower case, it must be encrypted. Encrypted messages
  must also be signed, so the first letter would be also in lower case.
  
  'NOOP': ignores payload. Can be used as oneway ping.

  'DSGN': signed data. Contains another container with signature.
    payload: {
      'algo': string, // defined: 'ed25519'
      'sig': string, // base64 signature
      'data': string, // base64 data, expected to contain Icquai Message Container JSON.
    }

  'DENC': AEAD-encrypted data. Contains another container encrypted.
    payload: {
      'algo': string, // defined: 'aes256-gcm'
      'iv': string, // base64 iv
      'ciphertext': string, // base64 ciphertext, expected to contain Icquai Message Container JSON.
    }
*/

export class IcquaiContainer {
  constructor(data) {
    //
    if ('object' != typeof data || null === data) {
      throw new TypeError('No data provided');
    }
    if (!('icquai_msg_version' in data)) {
      throw new TypeError('Unrecognized data');
    }
    if (1 === data.icquai_msg_version) {
      //
    } else {
      throw new TypeError('Unrecognized version');
    }
  }

  toJSON() {
    //
  }

  static create(type, payload) {
    //
  }
}
