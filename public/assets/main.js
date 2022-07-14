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

import "./lib/noble-ed25519.js";
import "./lib/es-first-aid.js";
import {LocalStorageData, Eternity, HtmlView as EH, ViewProperty as EP, ViewAttribute as EA} from "./lib/Eternity.js";
import { sha256 } from "./lib/crypto.js";

const ed = nobleEd25519;

const privateKeyStore = new LocalStorageData('icquai.private_key', () => firstAid.encodeBase64(ed.utils.randomPrivateKey()));

const getMyKeys = async () => {
  const base64PrivateKey = privateKeyStore.getValue();
  const privateKey = firstAid.decodeBase64(base64PrivateKey);

  /**
   * @type {Uint8Array}
   */
  const publicKey = await ed.getPublicKey(privateKey);

  const sha256Fingerprint = await sha256(publicKey);

  return {
    publicKey,
    privateKey,
    sha256Fingerprint,
  };
};

const containerElement = document.querySelector('#container');

const app = new Eternity;


// global topics

const wsOpen = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.open');
const wsConnecting = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.connecting');
const wsClosed = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.closed');
const wsMessageReceived = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.message.received');
const becomingOnline = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'network.online');
const becomingOffline = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'network.offline');
const becomingVisible = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.visible');
const becomingHidden = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.hidden');


// global event listeners

document.addEventListener('visibilitychange', ev => {
  if (!document.hidden) {
    becomingVisible.dispatch(null);
  } else {
    becomingHidden.dispatch(null);
  }
});

window.addEventListener('online', ev => {
  becomingOnline.dispatch(null);
});

window.addEventListener('offline', ev => {
  becomingOffline.dispatch(null);
});


/**
 * @type {WebSocket?}
 * */
 let ws = null;

 let wsUrl = `wss://${location.host}/ws`;

 const wsCallbacks = [];

 /**
  * 
  * @returns {Promise<WebSocket}
  */
 const waitForWs = () => new Promise((res) => {
  if (ws && ws.readyState == ws.OPEN) {
    res(ws);
  }
  wsCallbacks.push(res);
 });

 const openSocket = (force) => {
  if (!ws || ws.readyState == WebSocket.CLOSED || ws.readyState == WebSocket.CLOSING || force) {
      if (ws && ws.readyState == WebSocket.OPEN) {
          ws.close();
      }

      ws = new WebSocket(String(wsUrl));

      wsConnecting.dispatch(null);
      let keepAliveInterval;
      
      ws.addEventListener('open', ev => {
          console.log('ws: open');
          (async () => {
            const keys = await getMyKeys();
            const message = {
              type: "register",
            };
            const json = JSON.stringify(message);
            const data = firstAid.encodeString(json);
            const signature = await ed.sign(data, keys.privateKey);
            const signedMessage = {
              type: 'signed_envelope',
              algo: 'sign-ed25519',
              data: firstAid.encodeBase64(data),
              public_key: firstAid.encodeBase64(keys.publicKey),
              signature: firstAid.encodeBase64(signature),
            };
            const registerMsg = JSON.stringify(signedMessage);
            ws.send(registerMsg);

            wsOpen.dispatch(ws);
            for (const callback of wsCallbacks) {
              callback(ws);
            }
            wsCallbacks.length = 0; // clear the array
            keepAliveInterval = setInterval(() => {
              const message = {
                type: "keep_alive",
              };
              const messageJson = JSON.stringify(message);
              ws.send(messageJson);
            }, 15000);
          })();
      });
      ws.addEventListener('close', ev => {
          console.log('ws: close');
          clearInterval(keepAliveInterval);
          wsClosed.dispatch(null);
          setTimeout(() => {
              if (document.hidden || !navigator.onLine) return;
              console.log('Trying reconnection...');
              openSocket();
          }, 50);
      });

      ws.addEventListener('message', ev => {
          if (ev.target.readyState != WebSocket.OPEN) return;
          if (ws != ev.target) return;
          wsMessageReceived.dispatch(ev.data);
      });
  }
};

const wsSendMessage = async (message) => {
  const ws = await waitForWs();
  const keys = await getMyKeys();
  const json = JSON.stringify(message);
  const data = firstAid.encodeString(json);
  const signature = await ed.sign(data, keys.privateKey);
  const signedMessage = {
    type: 'signed_envelope',
    algo: 'sign-ed25519',
    data: firstAid.encodeBase64(data),
    public_key: firstAid.encodeBase64(keys.publicKey),
    signature: firstAid.encodeBase64(signature),
  };
  const signedJson = JSON.stringify(signedMessage);
  ws.send(signedJson);
};

becomingHidden.addListener(() => {
  // This is the last place to do something reliably.
  console.log('Page is now hidden!');
  // navigator.sendBeacon('/log', analyticsData);
});

becomingVisible.addListener(() => {
  console.log('Page is now visible!');
  openSocket();
})

becomingOnline.addListener(() => {
  console.log('Becoming online, reconnecting...');
  openSocket();
});

becomingOffline.addListener(() => {
  console.log('Becoming offline');
});

const store = app.getStore("store", (state) => {
  const drawerIsOpen = "drawerIsOpen" in state ? state.drawerIsOpen : false;
  const title = "title" in state ? state.title : 'Icquai';
  const headingText = "headingText" in state ? state.headingText : 'Home';
  return {
    ... state,
    online: navigator.onLine,
    webSocketIsOpen: false,
    webSocketStatus: 'CLOSED',
    drawerIsOpen,
    title,
    headingText,
  };
});

store.subscribe(wsOpen, (state, _action) => {
  return {
    ... state,
    webSocketIsOpen: true,
    webSocketStatus: 'OPEN',
  };
});

store.subscribe(wsConnecting, (state, _action) => {
  return {
    ... state,
    webSocketStatus: 'CONNECTING',
  };
});

store.subscribe(wsClosed, (state, _action) => {
  return {
    ... state,
    webSocketIsOpen: false,
    webSocketStatus: 'CLOSED',
  };
});

store.subscribe(becomingOnline, (state, _action) => {
  return {
    ... state,
    online: true,
  };
});

store.subscribe(becomingOffline, (state, _action) => {
  return {
    ... state,
    online: false,
  };
});

const openDrawer = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, "open_drawer");
const closeDrawer = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, "close_drawer");

store.subscribe(openDrawer, (state, _action) => {
  return {
    ... state,
    drawerIsOpen: true,
  };
});

store.subscribe(closeDrawer, (state, _action) => {
  return {
    ... state,
    drawerIsOpen: false,
  };
});

store.observe((state) => {
  document.title = state.title;
});

const renderDrawer = (isOpen, mainContent, drawerContent, mainHeader, drawerHeader) => {
  return EH.div([
    EA.id('drawer-wrapper'),
    EP.classes([isOpen ? 'drawer-open' : 'drawer-collapsed']),
  ], [
    EH.div([
      EA.id('drawer-main'),
    ], [
      EH.div([
        EA.id('drawer-main-header'),
      ], [
        EH.button([
          EA.id('drawer-open-button'),
          EP.classes(['material-icons', 'header-button']),
          EA.eventListener('click', (ev) => {
            openDrawer.dispatch(null);
          }),
        ], [
          EH.text('menu'),
        ]),
        EH.div([
          EA.id('drawer-main-header-content'),
        ], [
          mainHeader,
        ]),
      ]),
      EH.div([
        EA.id('drawer-main-content'),
      ], [
        mainContent,
      ]),
    ]),
    EH.div([
      EA.id('drawer-backdrop'),
      EA.eventListener('click', (ev) => {
        closeDrawer.dispatch(null);
      }),
    ], []),
    EH.div([
      EA.id('drawer'),
    ], [
      EH.div([
        EA.id('drawer-inner'),
      ], [
        EH.div([
          EA.id('drawer-inner-header'),
        ], [
          EH.button([
            EA.id('drawer-close-button'),
            EP.classes(['material-icons', 'header-button']),
            EA.eventListener('click', (ev) => {
              closeDrawer.dispatch(null);
            }),
          ], [
            EH.text('arrow_back'),
          ]),
          EH.div([
            EA.id('drawer-inner-header-content'),
          ], [
            drawerHeader,
          ]),
          //
        ]),
        EH.div([
          EA.id('drawer-inner-content'),
        ], [
          drawerContent,
        ]),
      ]),
    ]),
  ]);
};

store.render(containerElement, (state) => {
  //
  const mainContent = EH.div([], [EH.text('Main content')]);
  let connectionStatus;
  if (!state.online) {
    connectionStatus = EH.div([EA.id('connection-status'), EP.classes(['connection-offline'])], [
      EH.div([EP.classes(['material-icons'])], [EH.text('circle')]),
      EH.div([], [EH.text('Offline')]),
    ]);
  } else if ('CLOSED' == state.webSocketStatus) {
    connectionStatus = EH.div([EA.id('connection-status'), EP.classes(['connection-closed'])], [
      EH.div([EP.classes(['material-icons'])], [EH.text('circle')]),
      EH.div([], [EH.text('Connection closed')]),
    ]);
  } else if ('CONNECTING' == state.webSocketStatus) {
    connectionStatus = EH.div([EA.id('connection-status'), EP.classes(['connection-connecting'])], [
      EH.div([EP.classes(['material-icons'])], [EH.text('circle')]),
      EH.div([], [EH.text('Connecting')]),
    ]);
  } else {
    connectionStatus = EH.div([EA.id('connection-status'), EP.classes(['connection-connected'])], [
      EH.div([EP.classes(['material-icons'])], [EH.text('circle')]),
      EH.div([], [EH.text('Connected')]),
    ]);
  }
  const drawerContent = EH.div([], [
    connectionStatus,
  ]);
  const mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text(state.headingText)]);
  const drawerHeader = EH.h2([EP.classes(['drawer-logo'])], [
    EH.img([EP.attribute('src', '/assets/img/logo.svg')]),
    EH.text('Icquai'),
  ]);
  return renderDrawer(state.drawerIsOpen, mainContent, drawerContent, mainHeader, drawerHeader);
});


document.addEventListener('dblclick', ev => {
  ev.preventDefault();
});
