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

importScripts('/assets/lib/fetch-utils.js');

const ASSETS_CACHE = 'assets-v1';
const ASSETS = new URLSet([
  '/',
  '/assets/app.webmanifest', // en locale
  '/assets/css/drawer.css',
  '/assets/store.js',
  '/assets/sw-register.js',
  '/assets/main.css',
  '/assets/img/logo.svg',
  '/assets/img/app-icon-512px.png',
  '/assets/img/app-icon-256px.png',
  '/assets/img/fullsize-icon-256px.png',
  '/assets/img/app-icon-128px.png',
  '/assets/img/app-icon-192px.png',
  '/assets/main.js',
  '/assets/components/IcquaiTextarea.js',
  '/assets/lib/es-first-aid.d.ts',
  '/assets/lib/Eternity.js',
  '/assets/lib/es-first-aid.js',
  '/assets/lib/Eternity.d.ts',
  '/assets/lib/noble-ed25519.js',
  '/assets/lib/x25519.js',
  '/assets/lib/crypto.js',
  '/assets/lib/fetch-utils.js',
  '/assets/topics.js',
  '/assets/fonts/MaterialIcons-Regular.woff2',
  '/assets/app.js',
  '/sw.js',
]);

const CURRENT_CACHES = new Set([
  ASSETS_CACHE,
]);

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    console.log('sw: install');
    const cache = await caches.open(ASSETS_CACHE);
    const keys = await cache.keys();
    const cachedUrls = new Set;
    const promises = [];

    for (const req of keys) {
      if (!ASSETS.has(req.url)) {
        promises.push(cache.delete(req));
      } else {
        cachedUrls.add(req.url);
      }
    }

    for (const url of ASSETS) {
      if (!cachedUrls.has(url)) {
        const req = createFreshRequest(url);
        promises.push(rawFetch(req).then((res) => {
          return cache.put(req, res);
        }));
      }
    }

    await Promise.all(promises);
    return self.skipWaiting();
  })());
});

// cleanup of old cache
self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    console.log('sw: activate');
    const keys = await caches.keys();
    await Promise.all(keys.map(async key => {
      if (!CURRENT_CACHES.has(key)) {
        console.log('sw: Clearing unused cache:', key);
        return caches.delete(key);
      }
    }));
    await clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  ev.respondWith((async (request) => {
    const cache = await caches.open(ASSETS_CACHE);
    let match = await cache.match(request);
    const freshRequest = createFreshRequest(request);
    if (!match) {
      console.warn('Not cached:', request.url);
    }
    try {
      const freshResponse = await fetch(freshRequest);
      if (!freshResponse.ok) {
        throw 'Non-2xx response';
      }
      await cache.put(freshRequest, freshResponse.clone());
      return freshResponse;
    } catch (e) {
      if (!match || !match.ok) {
        console.error('sw: Request failed, but we do not have a valid cached response:', request.url, e);
        match = await cache.match('/');
      } else {
        console.warn('sw: fetch error:', request.url, e);
      }
      return match;
    }
  })(ev.request));
});

self.addEventListener('notificationclick', ev => {
  ev.waitUntil((async (notification) => {
    console.log('sw: notificationclick', {
      title: notification.title,
      tag: notification.tag,
      body: notification.body,
      data: notification.data,
    });
    const data = notification.data || {};
    const url = data.url || '';
    const windowClients = await clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    });
    for (const client of windowClients) {
      if ((!url || url == client.url) && 'function' == typeof client.focus) {
        await client.focus();
        notification.close();
        break;
      }
    }
  })(ev.notification));
});

self.addEventListener('message', ev => void ev.waitUntil((async () => {
  console.log('sw: message received:', ev.data);
  const data = ev.data || {};
  switch (data.command) {
    case 'client_hello': {
      console.log(`sw: client(${ev.source.id}) = session(${data.sessionId})`);
      
      const workers = [];
      const sharedWorkers = [];
      const windows = [];

      try {
        const allClients = await clients.matchAll({
          includeUncontrolled: true,
          type: 'all',
        });
        
        for (const client of allClients) {
          const clientData = {
            id: client.id,
            url: client.url,
            type: client.type,
          };
          if (client.type == 'window') {
            windows.push(clientData);
          } else if (client.type == 'worker') {
            workers.push(clientData);
          } else if (client.type == 'sharedworker') {
            sharedWorkers.push(clientData);
          }
        }
      } catch (e) {}
      
      ev.source.postMessage({
        command: 'sw_hello',
        clientId: ev.source.id,
        clients: {
          windows,
          workers,
          sharedWorkers,
        },
      });
      break;
    }

    default: {
      console.warn('sw: Unknown command received');
    }
  }
})()));
