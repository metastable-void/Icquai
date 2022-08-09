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


import { app } from './app.js';
import { Console } from './lib/console.js';
import { swNotificationClicked } from './topics.js';

const console = new Console('sw-register');


/** @type {ServiceWorkerRegistration} */
let serviceWorkerRegistration;

/** @type {ServiceWorker} */
let activeServiceWorker;

let swClientId;

let swStatus = 'unsupported';

/** @param {ServiceWorker} sw */
const newServiceWorkerCallback = (sw) => {
  if (sw == activeServiceWorker) return;
  activeServiceWorker = sw;
  console.log('New ServiceWorker:', sw);
  sw.postMessage({
    command: 'client_hello',
    sessionId: app.sessionId,
  });
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {scope: '/'}).then(reg => {
    console.log('ServiceWorker registered:', reg);
    serviceWorkerRegistration = reg;
  }).catch(e => {
    console.error('ServiceWorker registration failed:', e);
  });
  navigator.serviceWorker.ready.then(reg => {
    swStatus = 'ready';
    if (!reg.active) return;
    newServiceWorkerCallback(reg.active);
  });
  navigator.serviceWorker.addEventListener('controllerchange', ev => {
    if (!navigator.serviceWorker.controller) return;
    newServiceWorkerCallback(navigator.serviceWorker.controller);
  });
  navigator.serviceWorker.addEventListener('message', ev => {
    const data = ev.data || {};
    console.log('Message received from ServiceWorker:', ev.source);
    switch (data.command) {
      case 'sw_hello': {
        swClientId = data.clientId;
        console.log(`Learned: my clientId=${swClientId}`);
        console.log('Current ServiceWorker clients:', data.clients);
        break;
      }

      case 'notification_click': {
        console.log('Notification click received:', data.notificationData);
        swNotificationClicked.dispatch(data.notificationData);
        break;
      }

      default: {
        console.warn('Unknown command received');
      }
    }
  });
}

export const getClientId = () => {
  return swClientId;
};

export const isEnabled = () => swStatus == 'ready';

export const getRegistration = async () => {
  if ('serviceWorker' in navigator) {
    return await navigator.serviceWorker.getRegistration();
  } else {
    return undefined;
  }
};
