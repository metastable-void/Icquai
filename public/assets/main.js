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
import { app } from './app.js';
import { store } from "./store.js";
import {
  wsOpen,
  wsConnecting,
  wsClosed,
  wsMessageReceived,
  wsRegistered,
  wsMessageSend,
  becomingOnline,
  becomingOffline,
  becomingVisible,
  becomingHidden,
  becomingInteractive,
  pageShow,
  pageNavigate,
  myNameChange,
  myFingerprintChange,
  myInviteLinkChange,
  updateInviteLink,
} from "./topics.js";

const ed = nobleEd25519;

const privateKeyStore = new LocalStorageData('icquai.private_key', () => firstAid.encodeBase64(ed.utils.randomPrivateKey()));
const myNameStore = new LocalStorageData('icquai.my.name', () => '');

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


globalThis.app = app;

const verifyMessage = async (message) => {
  if (message.type != 'signed_envelope') {
    throw new TypeError('Not a signed message');
  }
  if (message.algo != 'sign-ed25519') {
    throw new TypeError('Unsupported algorithm');
  }
  const data = firstAid.decodeBase64(message.data);
  const signature = firstAid.decodeBase64(message.signature);
  const publicKey = firstAid.decodeBase64(message.public_key);
  if (!await ed.verify(signature, data, publicKey)) {
    throw new TypeError('Failed to verify message');
  }
  const json = firstAid.decodeString(data);
  const decodedMessage = JSON.parse(json);
  return {
    payload: decodedMessage,
    publicKey: message.public_key,
  };
};


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

globalThis.wsSendMessage = async (message) => {
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

pageNavigate.addListener((newUrl) => {
  const url = new URL(newUrl, location.href);
  const path = url.pathname;
  const query = url.searchParams;
  const hash = url.hash;
  if (path == '/') {
    setTimeout(() => {
      pageNavigate.dispatch('/me');
    }, 0);
  } else if (url.href != location.href) {
    history.replaceState({}, '', url.href);
  }
});

wsMessageSend.addListener((message) => {
  console.log('Sending message:', message);
  wsSendMessage(message).catch((e) => {
    console.error(e);
  });
});

becomingHidden.addListener(() => {
  // This is the last place to do something reliably.
  console.log('Page is now hidden!');
  // navigator.sendBeacon('/log', analyticsData);
});

becomingVisible.addListener(() => {
  console.log('Page is now visible!');
  openSocket();
});

becomingOnline.addListener(() => {
  console.log('Becoming online, reconnecting...');
  openSocket();
});

becomingOffline.addListener(() => {
  console.log('Becoming offline');
});

becomingInteractive.addListener(() => {
  console.log('Becoming interactive');
});

pageShow.addListener(() => {
  console.log('pageshow');
  openSocket();
});

wsMessageReceived.addListener((json) => {
  try {
    const message = JSON.parse(json);
    console.log('Message received:', message);
    switch (message.type) {
      case 'server_hello': {
        const registerMsg = {
          type: "register",
          nonce: message.nonce,
        };
        wsSendMessage(registerMsg).catch((e) => {
          console.error(e);
        });
        break;
      }
      case 'registered': {
        wsRegistered.dispatch(null);
        break;
      }
      case 'bounce': {
        console.warn('Message sent to %s bounced', message.recipient);
        break;
      }
      case 'signed_envelope': {
        (async () => {
          const {publicKey, payload} = await verifyMessage(message);
          console.log('Message from %s:', publicKey, payload);
        })().catch((e) => {
          console.error(e);
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
});


store.subscribe(myNameChange, (state, newName) => {
  return {
    ... state,
    myName: newName,
  };
});

store.subscribe(myFingerprintChange, (state, newFingerprint) => {
  return {
    ... state,
    myFingerprint: newFingerprint,
  };
});

store.subscribe(pageNavigate, (state, url) => {
  const newUrl = new URL(url, location.href);
  const path = newUrl.pathname;
  const hash = newUrl.hash;
  const query = newUrl.search;
  return {
    ... state,
    urlPath: path,
    urlHash: hash,
    urlQuery: query,
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
    wsRegistered: false,
  };
});

store.subscribe(wsRegistered, (state, _action) => {
  return {
    ... state,
    wsRegistered: true,
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

store.subscribe(myInviteLinkChange, (state, link) => {
  return {
    ... state,
    myInviteLink: link,
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

store.subscribe(updateInviteLink, (state, {publicKey, payload}) => {
  const {name} = payload;
  return {
    ... state,
    inviteLinkName: name,
    inviteLinkPublicKey: publicKey,
  };
});


myNameStore.observe((newName) => {
  myNameChange.dispatch(newName);
});

privateKeyStore.observe(async (_newPrivateKey) => {
  const keys = await getMyKeys();
  const fingerprint = firstAid.encodeHex(keys.sha256Fingerprint);
  myFingerprintChange.dispatch(fingerprint);
});

const inviteLinkObserver = async () => {
  const myName = myNameStore.getValue();
  const keys = await getMyKeys();
  const message = {
    type: 'invite_link',
    name: myName,
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
  const signedJson = JSON.stringify(signedMessage);
  const bytes = firstAid.encodeString(signedJson);
  const link = new URL(`/invite#${firstAid.encodeBase64(bytes)}`, location.href).href;
  myInviteLinkChange.dispatch(link);
};

myNameStore.observe(inviteLinkObserver);
privateKeyStore.observe(inviteLinkObserver);

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

const createInputField = (label, id, eventListeners, placeholder) => {
  const input = EH.div([EA.classes(['input-field'])], [
    EH.label([EP.attribute('for', id)], [EH.text(label)]),
    EH.input([
      EP.attribute('type', 'text'),
      EA.id(id),
      ... eventListeners,
      EP.attribute('placeholder', placeholder),
    ]),
  ]);
  //
  return input;
};

const containerElement = document.querySelector('#container');
store.render(containerElement, (state) => {
  const query = new URLSearchParams(state.urlQuery);
  const hash = state.urlHash;
  let mainHeader;
  let mainContent;
  const notFound = () => {
    mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Not Found')]);
    mainContent = EH.div([], [
      EH.meta([
        EP.attribute('name', 'robot'),
        EP.attribute('content', 'noindex'),
      ]),
      EH.h1([], [EH.text('Not Found')]),
    ]);
  };
  switch (state.urlPath) {
    case '/me': {
      // my profile
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('My Profile')]);
      const fingerprint = createInputField('Fingerprint', 'my-fingerprint', [
        EP.attribute('readonly', ''),
        EP.attribute('value', state.myFingerprint),
      ], '');
      const name = createInputField('Name', 'my-name', [
        EP.attribute('value', state.myName),
        EP.eventListener('change', (ev) => {
          const value = String(ev.target.value).trim();
          if ('' == value) {
            return;
          }
          myNameStore.setValue(value);
        }),
      ], 'name');
      const inviteLink = createInputField('Invite Link', 'my-invite-link', [
        EP.attribute('readonly', ''),
        EP.attribute('value', state.myInviteLink),
      ], '');
      mainContent = EH.div([EA.classes(['profile'])], [
        fingerprint,
        name,
        inviteLink,
      ]);
      break;
    }
    case '/invite': {
      // invite link
      try {
        const bytes = firstAid.decodeBase64(hash);
        const signedJson = firstAid.decodeString(bytes);
        const signedData = JSON.parse(signedJson);
        // TODO: This is not how pure functions work
        verifyMessage(signedData).then(({publicKey, payload}) => {
          if (payload.type != 'invite_link') {
            throw new TypeError('Not an invite link');
          }
          updateInviteLink.dispatch({publicKey, payload});
        }).catch((e) => {
          console.error(e);
          updateInviteLink.dispatch({publicKey: '', payload: {name: ''}});
        });
        mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Add Friend')]);
        if (state.inviteLinkPublicKey == '') {
          mainContent = EH.div([EA.classes(['profile'])], [
            EH.p([], [EH.text('Invite link is invalid.')]),
          ]);
        } else {
          const publicKey = createInputField('Public Key', 'invite-public-key', [
            EP.attribute('value', state.inviteLinkPublicKey),
            EP.attribute('readonly', ''),
          ], '');
          const name = createInputField('Name', 'invite-link-name', [
            EP.attribute('value', state.inviteLinkName),
            EP.attribute('readonly', ''),
          ], '');
          mainContent = EH.div([EA.classes(['profile'])], [
            publicKey,
            name,
          ]);

        }
      } catch (e) {
        notFound();
        break;
      }
      break;
    }
    case '/friends': {
      // friends
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Friends')]);
      mainContent = EH.div([], [EH.text('Main content')]);
      break;
    }
    case '/talk': {
      if (!query.has('public_key')) {
        notFound();
        break;
      }
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Talk')]);
      mainContent = EH.div([], [EH.text('Main content')]);
      break;
    }
    default: {
      // not found
      notFound();
      break;
    }
  }
  //
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
  } else if ('OPEN' == state.webSocketStatus && state.wsRegistered) {
    connectionStatus = EH.div([EA.id('connection-status'), EP.classes(['connection-connected'])], [
      EH.div([EP.classes(['material-icons'])], [EH.text('circle')]),
      EH.div([], [EH.text('Connected')]),
    ]);
  } else {
    connectionStatus = EH.div([EA.id('connection-status'), EP.classes(['connection-connecting'])], [
      EH.div([EP.classes(['material-icons'])], [EH.text('circle')]),
      EH.div([], [EH.text('Connecting')]),
    ]);
  }
  const createNavigationItem = (url, label, icon) => EH.ul([], [
    EH.li([], [
      EH.a([
        EP.attribute('href', url),
      ], [
        EH.span([EA.classes(['material-icons'])], [EH.text(icon)]),
        EH.span([], [EH.text(label)]),
      ]),
    ]),
  ]);
  const drawerContent = EH.div([], [
    connectionStatus,
    EH.nav([
      EA.id('main-navigation'),
    ], [
      createNavigationItem('/me', 'My Profile', 'account_circle'),
      createNavigationItem('/friends', 'Friends', 'people'),
      createNavigationItem('/settings', 'Settings', 'settings'),
      createNavigationItem('/help', 'Help', 'help'),
    ]),
  ]);
  const drawerHeader = EH.h2([EP.classes(['drawer-logo'])], [
    EH.img([EP.attribute('src', '/assets/img/logo.svg')]),
    EH.text('Icquai'),
  ]);
  return renderDrawer(state.drawerIsOpen, mainContent, drawerContent, mainHeader, drawerHeader);
});


document.addEventListener('dblclick', ev => {
  ev.preventDefault();
});

document.addEventListener ('click', ev => {
  const composedPath = ev.composedPath();
  for (let target of composedPath) {
    if (!target.tagName || 'a' !== target.tagName.toLowerCase ()) {
      continue;
    }
    
    if (!target.href) {
      continue;
    }
    
    ev.preventDefault();
    
    const action = new URL (target.href, location.href);
    console.log (action);
    if (action.host !== location.host) {
      window.open(action.href, '_blank');
    } else {
      pageNavigate.dispatch(action.href);
    }
    return;
  }
});

pageNavigate.dispatch(location.href);
