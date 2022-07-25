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

/* This file can be loaded as either normal script or module script. */

globalThis.normalizeUrl = (pathOrUrl) => String(new URL(pathOrUrl, location.href));

/**
 * @extends Set<string>
 */
globalThis.URLSet = class URLSet extends Set {
  /**
   * @param {Iterable<string} urls URLs to add.
   */
  constructor(urls) {
    super([... urls].map((url) => normalizeUrl(url)));
  }

  add(url) {
    return super.add(normalizeUrl(url));
  }

  delete(url) {
    return super.delete(normalizeUrl(url));
  }

  has(url) {
    return super.has(normalizeUrl(url));
  }
};

globalThis.createFreshRequest = (req) => {
  const originalRequest = (req instanceof Request
    ? (
      req.mode == 'navigate'
      ? new Request(req.url, {
        mode: 'cors',
        credentials: 'same-origin',
      })
      : req
    )
    : new Request(req, {
      mode: 'cors',
      credentials: 'same-origin',
    })
  );

  return new Request(originalRequest, {
    mode: originalRequest.mode,
    credentials: originalRequest.credentials,
    cache: 'no-cache', // force revalidation
  });
};

/**
 * fetch() with explicit error Response on network errors.
 * @param {RequestInfo} input 
 * @param {RequestInit?} init?
 * @returns 
 */
globalThis.rawFetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (e) {
    console.error('fetch error:', e);
    return Response.error();
  }
};
