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
import "./sw-register.js";
import * as x25519 from "./lib/x25519.js";
import {LocalStorageData, Eternity, HtmlView as EH, ViewProperty as EP, ViewAttribute as EA} from "./lib/Eternity.js";
import { sha256 } from "./lib/crypto.js";
import { app } from './app.js';
import { store } from "./store.js";
import { IcquaiTextarea } from "./components/IcquaiTextarea.js";
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
  friendsInviteLinkChange,
  friendsChange,
  friendsInviteNicknameChange,
  friendBecomingOnline,
  friendBecomingOffline,
  channelOpened,
  channelClosed,
  channelTextUpdate,
  rtcIceCandidate,
  rtcDescription,
} from "./topics.js";

const ed = nobleEd25519;

const HISTORY_BUFFER_LENGTH = 10;

// watchdog
let scriptCompleted = false;
window.addEventListener('error', ev => {
    if (!scriptCompleted) {
        setTimeout(() => location.reload(), 10000);
    }
});

const privateKeyStore = new LocalStorageData('icquai.private_key', () => firstAid.encodeBase64(ed.utils.randomPrivateKey()));
const myNameStore = new LocalStorageData('icquai.my.name', () => '');
const friendsStore = new LocalStorageData('icquai.friends', () => []);

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

const getTime = () => +new Date;


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
    publicKey: String(message.public_key),
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

globalThis.wsForwardMessage = async (recipientBase64PublicKey, message) => {
  const msg = {
    type: 'forward',
    recipient: recipientBase64PublicKey,
    payload: message,
  };
  await wsSendMessage(msg);
};

const PING_TIMEOUT = 5000;
const validPingNonces = new Set;
const sendPing = async (base64PublicKey) => {
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = firstAid.encodeBase64(nonceBytes);
  validPingNonces.add(nonce);
  const message = {
    type: 'ping',
    nonce,
  };
  await wsForwardMessage(base64PublicKey, message);
  setTimeout(() => {
    validPingNonces.delete(nonce);
  }, PING_TIMEOUT);
};

const x25519Generate = () => {
    const seed = new Uint8Array(32);
    firstAid.randomFill(seed);
    const keyPair = x25519.generateKeyPair(seed);
    return {
        privateKey: new Uint8Array(keyPair.private.buffer, keyPair.private.byteOffset, keyPair.private.byteLength),
        publicKey: new Uint8Array(keyPair.public.buffer, keyPair.public.byteOffset, keyPair.public.byteLength),
    };
};

const deriveKey = async (keyBytes) => {
  const rawKey = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
  return await crypto.subtle.deriveKey({
    name: 'HKDF',
    hash: 'SHA-256',
    info: new ArrayBuffer(0),
    salt: new ArrayBuffer(0)
  }, rawKey, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
};

const encrypt = async (dataBytes, keyBytes) => {
  const key = await deriveKey(keyBytes);
  const iv = firstAid.randomFill(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, dataBytes);
  return {
    type: 'encrypted_envelope',
    algo: 'AES-GCM',
    ciphertext: firstAid.encodeBase64(ciphertext),
    iv: firstAid.encodeBase64(iv),
  };
};

const decrypt = async (dataObj, keyBytes) => {
  if ('encrypted_envelope' != dataObj.type) {
    throw new TypeError('Not an encrypted envelope');
  }
  if ('AES-GCM' != dataObj.algo) {
    throw new TypeError('Unknown algorithm');
  }
  const key = await deriveKey(keyBytes);
  const iv = firstAid.decodeBase64(dataObj.iv);
  const ciphertext = firstAid.decodeBase64(dataObj.ciphertext);
  const resultBuffer = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, ciphertext);
  return new Uint8Array(resultBuffer);
};

const validKexNonces = new Set;
const kexKeyMap = new Map; // ed25519 public key -> x25519 key pair
const sharedSecretMap = new Map; // ed25519 public key -> shared secret
const sessionIdMap = new Map; // ed25519 public key -> peer session id
const sendKexPing = async (base64PublicKey) => {
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = firstAid.encodeBase64(nonceBytes);
  const name = myNameStore.getValue();
  validKexNonces.add(nonce);
  const keyPair = x25519Generate();
  kexKeyMap.set(base64PublicKey, keyPair);
  const message = {
    type: 'kex_ping',
    nonce,
    peerSessionId: app.sessionId,
    publicKey: firstAid.encodeBase64(keyPair.publicKey),
    name,
  };
  await wsForwardMessage(base64PublicKey, message);
};

globalThis.sendEncryptedMessage = async (base64PublicKey, message) => {
  const data = firstAid.encodeString(JSON.stringify(message));
  const keyBytes = sharedSecretMap.get(base64PublicKey);
  if (!keyBytes) {
    throw new Error('Shared secret not found');
  }
  const encryptedMessage = await encrypt(data, keyBytes);
  await wsForwardMessage(base64PublicKey, encryptedMessage);
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
    if (message.type != 'signed_envelope') {
      console.log('Message received:', message);
    }
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
        console.info('Registered to server');
        wsRegistered.dispatch(null);
        break;
      }
      case 'bounce': {
        console.warn('Message sent to %s bounced', message.recipient);
        friendBecomingOffline.dispatch(message.recipient);
        break;
      }
      case 'signed_envelope': {
        (async () => {
          const {publicKey, payload} = await verifyMessage(message);
          if ('forward' == payload.type) {
            const message = payload.payload;
            console.log('Message from %s:', publicKey, message);
            switch (message.type) {
              case 'ping': {
                console.log('Received ping; ponging.');
                const name = myNameStore.getValue();
                const pongMsg = {
                  type: 'pong',
                  name,
                  nonce: message.nonce,
                };
                wsForwardMessage(publicKey, pongMsg).catch((e) => {
                  console.error(e);
                });
                break;
              }
              case 'pong': {
                if (!validPingNonces.has(message.nonce)) {
                  console.warn('Invalid nonce in ping');
                  break;
                }
                validPingNonces.delete(message.nonce);
                console.log('Received pong. Name:', message.name);
                friendBecomingOnline.dispatch(publicKey);
                if (!message.name) {
                  break;
                }
                const friends = friendsStore.getValue();
                for (const friend of friends) {
                  if (publicKey == friend.publicKey) {
                    friend.savedName = message.name;
                  }
                }
                friendsStore.setValue(friends);
                break;
              }
              case 'kex_ping': {
                const keyPair = x25519Generate();
                const name = myNameStore.getValue();
                const pongMsg = {
                  type: 'kex_pong',
                  nonce: message.nonce,
                  peerSessionId: message.peerSessionId,
                  sessionId: app.sessionId,
                  publicKey: firstAid.encodeBase64(keyPair.publicKey),
                  name,
                };
                wsForwardMessage(publicKey, pongMsg).catch((e) => {
                  console.error(e);
                });
                const sharedSecret = await sha256(x25519.sharedKey(keyPair.privateKey, firstAid.decodeBase64(message.publicKey)));
                sharedSecretMap.set(publicKey, sharedSecret);
                sessionIdMap.set(publicKey, message.peerSessionId);
                channelOpened.dispatch(publicKey);
                const friends = friendsStore.getValue();
                let found = false;
                for (const friend of friends) {
                  if (publicKey == friend.publicKey) {
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  const friend = {
                    nickname: message.name,
                    savedName: message.name,
                    publicKey,
                  };
                  friends.push(friend);
                  friendsStore.setValue(friends);
                }
                pageNavigate.dispatch(`/talk?public_key=${encodeURIComponent(publicKey)}`);
                break;
              }
              case 'kex_pong': {
                const sessionId = message.peerSessionId;
                if (app.sessionId != sessionId) {
                  console.log('Unmatching session id, ignoring key exchange...');
                  break;
                }
                const nonce = message.nonce;
                if (!validKexNonces.has(nonce)) {
                  console.warn('Invalid nonce in key exchange');
                  break;
                }
                if (!kexKeyMap.has(publicKey)) {
                  console.warn('Unknown key in key exchange');
                  break;
                }
                const myKeyPair = kexKeyMap.get(publicKey);
                validKexNonces.delete(nonce);
                const sharedSecret = await sha256(x25519.sharedKey(myKeyPair.privateKey, firstAid.decodeBase64(message.publicKey)));
                sharedSecretMap.set(publicKey, sharedSecret);
                sessionIdMap.set(publicKey, message.sessionId);
                channelOpened.dispatch(publicKey);
                break;
              }
              case 'encrypted_envelope': {
                const sharedSecret = sharedSecretMap.get(publicKey);
                if (!sharedSecret) {
                  console.warn('Shared secret not found');
                  const rstMsg = {
                    type: 'ch_rst',
                    sessionId: app.sessionId,
                  };
                  wsForwardMessage(publicKey, rstMsg).catch((e) => {
                    console.error(e);
                  });
                  break;
                }
                const data = await decrypt(message, sharedSecret);
                const payload = JSON.parse(firstAid.decodeString(data));
                console.log('encrypted message from %s:', publicKey, payload);
                switch (payload.type) {
                  case 'text_cleared': {
                    channelTextUpdate.dispatch({
                      publicKey,
                      text: payload.text,
                      caretOffset: payload.caretOffset,
                    });
                    break;
                  }
                  case 'text_updated': {
                    channelTextUpdate.dispatch({
                      publicKey,
                      text: payload.text,
                      caretOffset: payload.caretOffset,
                    });
                    break;
                  }
                  case 'rtc_init': {
                    console.log('Received RTC init');
                    createCall(publicKey, false).catch((e) => {
                      console.error(e);
                    });
                    break;
                  }
                  case 'rtc_ice_candidate': {
                    console.log('Received ice candidate:', payload.candidate);
                    rtcIceCandidate.dispatch(payload.candidate);
                    break;
                  }
                  case 'rtc_description': {
                    console.log('Received RTC description:', payload.description);
                    rtcDescription.dispatch(payload.description);
                    break;
                  }
                }
                break;
              }
              case 'ch_rst': {
                const peerSessionId = sessionIdMap.get(publicKey);
                if (!peerSessionId) {
                  break;
                }
                if (message.sessionId == peerSessionId) {
                  sharedSecretMap.delete(publicKey);
                  channelClosed.dispatch(publicKey);
                }
                break;
              }
            }
          }
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

store.subscribe(channelTextUpdate, (state, action) => {
  const {publicKey, text, caretOffset} = action;
  const {channelTexts} = state;
  channelTexts[publicKey] = {text, caretOffset};
  return {
    ... state,
    channelTexts,
  };
});

store.observe((state) => {
  document.title = state.title;
});

store.subscribe(channelOpened, (state, publicKey) => {
  const {openChannels} = state;
  if (!openChannels.includes(publicKey)) {
    openChannels.push(publicKey);
  }
  return {
    ... state,
    openChannels,
  };
});

store.subscribe(channelClosed, (state, publicKey) => {
  const {openChannels} = state;
  const set = new Set(openChannels);
  set.delete(publicKey);
  return {
    ... state,
    openChannels: [... set],
  };
});

store.subscribe(friendsInviteLinkChange, (state, link) => {
  return {
    ... state,
    friendsInviteLink: link,
  };
});

store.subscribe(friendsChange, (state, friends) => {
  return {
    ... state,
    friends,
  };
});

store.subscribe(friendsInviteNicknameChange, (state, friendsInviteNickname) => {
  return {
    ... state,
    friendsInviteNickname,
  };
});

store.subscribe(friendBecomingOnline, (state, publicKey) => {
  const {onlineFriends} = state;
  if (!onlineFriends.includes(publicKey)) {
    onlineFriends.push(publicKey);
  }
  return {
    ... state,
    onlineFriends,
  };
});

store.subscribe(friendBecomingOffline, (state, publicKey) => {
  const {onlineFriends} = state;
  const set = new Set(onlineFriends);
  set.delete(publicKey);
  return {
    ... state,
    onlineFriends: [... set],
  };
});

let lastUrlPath;
store.observe((state) => {
  const urlPath = state.urlPath;
  if ('/friends' == urlPath && lastUrlPath != urlPath) {
    const friends = friendsStore.getValue();
    for (const friend of friends) {
      sendPing(friend.publicKey).catch((e) => {
        console.error(e);
      });
    }
  }
  lastUrlPath = urlPath;
});


setInterval(() => {
  const state = store.state;
  if ('/talk' != state.urlPath) {
    return;
  }
  const query = new URLSearchParams(state.urlQuery);
  if (!query.has('public_key')) {
    return;
  }
  const publicKey = query.get('public_key');
  if (!publicKey) {
    return;
  }
  sendPing(publicKey).catch((e) => {
    console.error(e);
  });
}, 5000);

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

friendsStore.observe((friends) => {
  friendsChange.dispatch(friends);
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

const addFriend = async (publicKey, savedName, nickname) => {
  publicKey = firstAid.encodeBase64(firstAid.decodeBase64(publicKey));
  const keys = await getMyKeys();
  const myPublicKey = firstAid.encodeBase64(keys.publicKey);
  if (publicKey == myPublicKey) {
    return;
  }
  const friends = friendsStore.getValue();
  let found = false;
  for (const friend of friends) {
    if (friend.publicKey == publicKey) {
      found = true;
      break;
    }
  }
  if (!nickname) {
    nickname = savedName;
  }
  if (!found) {
    const friend = {
      publicKey,
      savedName,
      nickname,
    };
    friends.push(friend);
  }
  friendsStore.setValue(friends);
};

const changeFriendNickname = (publicKey, nickname) => {
  publicKey = firstAid.encodeBase64(firstAid.decodeBase64(publicKey));
  nickname = String(nickname || '').trim();
  if (!nickname) {
    return;
  }
  const friends = friendsStore.getValue();
  for (const friend of friends) {
    if (friend.publicKey == publicKey) {
      friend.nickname = nickname;
      break;
    }
  }
  friendsStore.setValue(friends);
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


let lastUpdate = 0;
const historyBuffer = [];
let previousText = '';
const sendUpdate = (textBox, base64PublicKey, force) => {
  if (textBox.value.includes('\n')) {
    textBox.value = textBox.value.split('\n').join('').split('\r').join('');
  }
  const text = textBox.value;
  if (text == previousText && !force) return;
  previousText = text;
  lastUpdate = getTime();
  const offset = textBox.caretOffset;

  if (text.length < 1) {
    sendEncryptedMessage(base64PublicKey, {
      type: 'text_cleared',
      text: '',
      caretOffset: offset,
    }).catch((e) => {
      console.error(e);
    });
  } else {
    sendEncryptedMessage(base64PublicKey, {
      type: 'text_updated',
      text,
      caretOffset: offset,
    }).catch((e) => {
      console.error(e);
    });
  }
};

const commit = (textBox, base64PublicKey) => {
  const text = textBox.value;
  textBox.value = '';
  const offset = textBox.caretOffset;
  if (previousText == '') return;
  previousText = text;
  lastUpdate = getTime();
  historyBuffer.push(previousText);
  console.log('Added text to history: ', previousText);
  while (historyBuffer.length > HISTORY_BUFFER_LENGTH) {
    historyBuffer.shift();
  }
  previousText = '';
  sendEncryptedMessage(base64PublicKey, {
    type: 'text_cleared',
    text: '',
    caretOffset: offset,
  }).catch((e) => {
    console.error(e);
  });
}

const historyBack = (textBox, base64PublicKey) => {
  if (historyBuffer.length < 1) return;
  const text = historyBuffer.pop();
  console.log('Hitory from buffer:', text);
  textBox.value = text;
  const offset = textBox.caretOffset;
  previousText = text;
  sendEncryptedMessage(base64PublicKey, {
    type: 'text_updated',
    text,
    caretOffset: offset,
  });
};

const getAudio = async () => {
  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
};

const createCall = async (base64PublicKey, selfInitiated) => {
  //
  const audioElement = document.querySelector('#rtc_audio');
  const configuration = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  };

  if (selfInitiated) {
    await sendEncryptedMessage(base64PublicKey, {
      type: 'rtc_init',
    });
  }

  const pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = ({candidate}) => {
    sendEncryptedMessage(base64PublicKey, {
      type: 'rtc_ice_candidate',
      candidate,
    }).catch((e) => {
      console.error(e);
    });
  };

  pc.onnegotiationneeded = async () => {
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await sendEncryptedMessage(base64PublicKey, {
        type: 'rtc_description',
        description: pc.localDescription,
      });
    } catch (e) {
      console.error(e);
    }
  };

  pc.ontrack = (event) => {
    if (audioElement.srcObject) {
      return;
    }
    audioElement.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = (ev) => {
    console.log('RTC connection state:', pc.connectionState);
  };

  rtcIceCandidate.addListener(async (candidate) => {
    await pc.addIceCandidate(candidate);
  });

  rtcDescription.addListener(async (description) => {
    if (description.type == 'offer') {
      await pc.setRemoteDescription(description);
      const stream = await getAudio();
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      await pc.setLocalDescription(await pc.createAnswer());
      await sendEncryptedMessage(base64PublicKey, {
        type: 'rtc_description',
        description: pc.localDescription,
      });
    } else {
      await pc.setRemoteDescription(description);
    }
  });

  if (selfInitiated) {
    const stream = await getAudio();
    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }
};

const containerElement = document.querySelector('#container');
store.render(containerElement, async (state) => {
  const query = new URLSearchParams(state.urlQuery);
  const hash = state.urlHash;
  let mainHeader;
  let mainContent;
  const notFound = () => {
    mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Not Found')]);
    mainContent = EH.div([EA.classes(['profile'])], [
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
        EH.p([], [EH.text('Please set your name.')]),
        fingerprint,
        name,
        inviteLink,
        EH.p([], [
          EH.button([
            EP.eventListener('click', (ev) => {
              navigator.clipboard.writeText(state.myInviteLink).catch((e) => {
                console.error('Failed to copy string to clipboard:', e);
              });
            }),
          ], [EH.text('Copy link')]),
        ]),
      ]);
      break;
    }
    case '/invite': {
      // invite link
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Add Friend')]);
      try {
        const bytes = firstAid.decodeBase64(hash.slice(1));
        const signedJson = firstAid.decodeString(bytes);
        const signedData = JSON.parse(signedJson);
        // TODO: This is not how pure functions work
        const message = await verifyMessage(signedData);
        const {payload} = message;
        if (payload.type != 'invite_link') {
          throw new TypeError('Not an invite link');
        }
        const publicKeyField = createInputField('Public Key', 'invite-public-key', [
          EP.attribute('value', message.publicKey),
          EP.attribute('readonly', ''),
        ], '');
        const name = createInputField('Name', 'invite-link-name', [
          EP.attribute('value', payload.name),
          EP.attribute('readonly', ''),
        ], '');
        const nickName = createInputField('Nickname', 'invite-link-nickname', [
          EP.eventListener('change', (ev) => {
            const value = String(ev.target.value).trim();
            if ('' == value) {
              return;
            }
            friendsInviteNicknameChange.dispatch(value);
          }),
        ], 'Add nickname');
        const addFriendButton = EH.button([
          EP.eventListener('click', (ev) => {
            addFriend(message.publicKey, payload.name, state.friendsInviteNickname).then(() => {
              setTimeout(() => {
                pageNavigate.dispatch('/friends');
              }, 0);
            }).catch((e) => {
              console.error(e);
            });
          }),
        ], [
          EH.text('Add friend'),
        ]);
        mainContent = EH.div([EA.classes(['profile'])], [
          publicKeyField,
          name,
          nickName,
          EH.p([], [addFriendButton]),
        ]);
      } catch (e) {
        console.warn(e);
        mainContent = EH.div([EA.classes(['profile'])], [
          EH.p([], [EH.text('Invite link is invalid.')]),
        ]);
        break;
      }
      break;
    }
    case '/friends': {
      // friends
      const friendsList = [];
      for (const friend of state.friends) {
        const isOnline = state.onlineFriends.includes(friend.publicKey);
        const tr = EH.tr([
          EA.classes([isOnline ? 'online' : 'offline']),
          EP.eventListener('click', (ev) => {
            pageNavigate.dispatch(`/talk?public_key=${encodeURIComponent(friend.publicKey)}`);
          }),
        ], [
          EH.td([
            EA.classes(['online-status']),
            EP.attribute('title', isOnline ? 'Online' : 'Offline'),
          ], [
            EH.span([EA.classes(['material-icons'])], [EH.text('circle')]),
          ]),
          EH.td([EA.classes(['name'])], [EH.text(friend.savedName)]),
          EH.td([EA.classes(['nickname'])], [EH.text(friend.nickname)]),
        ]);
        friendsList.push(tr);
      }
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Friends')]);
      mainContent = EH.div([EA.classes(['profile'])], [
        EH.div([], [
          createInputField('Invite link', 'friends-invite-link', [
            EP.eventListener('change', (ev) => {
              friendsInviteLinkChange.dispatch(ev.target.value);
            }),
          ], 'Paste invite link here'),
          EH.p([], [
            EH.button([
              EP.eventListener('click', (ev) => {
                const url = new URL(state.friendsInviteLink, location.href);
                if ('/invite' != url.pathname) {
                  return;
                }
                pageNavigate.dispatch(`/invite${url.hash}`);
              }),
            ], [EH.text('Add friend')]),
          ]),
        ]),
        EH.table([EA.classes(['friends'])], [
          EH.thead([], [
            EH.tr([], [
              EH.th([], []),
              EH.th([], [EH.text('Name')]),
              EH.th([], [EH.text('Nickname')]),
            ]),
          ]),
          EH.tbody([], [
            ... friendsList,
          ]),
        ]),
      ]);
      break;
    }
    case '/talk': {
      if (!query.has('public_key')) {
        notFound();
        break;
      }
      const publicKey = query.get('public_key');
      if (!publicKey) {
        notFound();
        break;
      }
      let friend;
      for (const value of state.friends) {
        if (value.publicKey == publicKey) {
          friend = value;
          break;
        }
      }
      const name = friend ? friend.savedName : 'Talk';
      const isOnline = state.onlineFriends.includes(publicKey);
      const publicKeyBytes = firstAid.decodeBase64(publicKey);
      const fingerprint = await sha256(publicKeyBytes);
      const hexFingerprint = firstAid.encodeHex(fingerprint);
      let channelStatus;
      let textarea;
      let peerText;
      if (state.openChannels.includes(publicKey)) {
        let textStatus = {
          text: '',
          caretOffset: -1,
        };
        if (publicKey in state.channelTexts) {
          textStatus = state.channelTexts[publicKey];
        }
        channelStatus = EH.div([
          EA.id('channel-status'),
        ], [
          EH.p([], [EH.text('Chat is open.')]),
          EH.p([], [
            EH.button([
              EP.eventListener('click', (ev) => {
                //
                sharedSecretMap.delete(publicKey);
                channelClosed.dispatch(publicKey);
              }),
            ], [EH.text('Close chat')]),
          ]),
        ]);
        textarea = EH.customTag('icquai-textarea', [
          EA.classes(['text']),
          EP.eventListener('keydown', (ev) => {
            const target = ev.currentTarget;
            if (ev.keyCode == 13) {
              // ENTER
              ev.preventDefault();
              sendUpdate(target, publicKey);
              commit(target, publicKey);
            } else if (ev.keyCode == 38) {
              // ARROW UP
              ev.preventDefault();
              historyBack(target, publicKey);
            }
          }),
          EP.eventListener('input', (ev) => {
            sendUpdate(ev.currentTarget, publicKey);
          }),
        ], [EH.text('')]);
        if (textStatus.caretOffset < 0) {
          peerText = EH.div([EA.classes(['text'])], [
            EH.text(textStatus.text),
          ]);
        } else {
          peerText = EH.div([EA.classes(['text'])], [
            EH.text(textStatus.text.slice(0, textStatus.caretOffset)),
            EH.span([EA.classes(['cursor'])], []),
            EH.text(textStatus.text.slice(textStatus.caretOffset)),
          ]);
        }
      } else {
        channelStatus = EH.div([
          EA.id('channel-status'),
        ], [
          EH.p([], [EH.text('Chat is closed.')]),
          EH.p([], [
            EH.button([
              EP.eventListener('click', (ev) => {
                sendKexPing(publicKey).catch((e) => {
                  console.error(e);
                });
              }),
            ], [EH.text('Request chat')]),
          ]),
        ]);
        textarea = EH.textarea([
          EP.attribute('disabled', ''),
          EA.classes(['text']),
        ], []);
        peerText = EH.div([EA.classes(['text'])], [
          EH.text(''),
        ]);
      }
      mainHeader = EH.div([EP.classes(['talk-toolbar'])], [
        EH.h2([EA.classes(['header-headding'])], [EH.text(name)]),
        EH.div([
          EA.classes(['talk-toolbar-status', 'material-icons', isOnline ? 'online' : 'offline']),
          EP.attribute('title', isOnline ? 'Online' : 'Offline'),
        ], [
          EH.text('circle'),
        ]),
        EH.button([
          EA.classes(['material-icons']),
          EP.eventListener('click', (ev) => {
            //
            if (state.openChannels.includes(publicKey)) {
              // initiate call
              createCall(publicKey, true).catch((e) => {
                console.error(e);
              });
            } else {
              sendKexPing(publicKey).catch((e) => {
                console.error(e);
              });
            }
          }),
        ], [EH.text('call')]),
      ]);
      mainContent = EH.div([
        EA.classes(['talk']),
      ], [
        channelStatus,
        EH.div([
          EA.id('talk-box-friend'),
          EA.classes(['talk-box']),
        ], [
          EH.div([EA.classes(['talk-box-header'])], [
            EH.input([
              EA.classes(['name']),
              EP.attribute('type', 'text'),
              EP.attribute('value', friend.nickname),
              EP.eventListener('change', (ev) => {
                const value = String(ev.target.value).trim();
                if ('' == value) {
                  return;
                }
                changeFriendNickname(publicKey, value);
              }),
            ]),
            EH.div([EA.classes(['fingerprint'])], [
              EH.text(hexFingerprint),
            ]),
          ]),
          peerText,
        ]),
        EH.div([
          EA.id('talk-box-self'),
          EA.classes(['talk-box']),
        ], [
          EH.div([EA.classes(['talk-box-header'])], [
            EH.input([
              EA.classes(['name']),
              EP.attribute('type', 'text'),
              EP.attribute('value', state.myName),
              EP.eventListener('change', (ev) => {
                const value = String(ev.target.value).trim();
                if ('' == value) {
                  return;
                }
                myNameStore.setValue(value);
              }),
            ]),
            EH.div([EA.classes(['fingerprint'])], [
              EH.text(state.myFingerprint),
            ]),
          ]),
          textarea,
        ]),
      ]);
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
    EH.audio([
      EA.id('rtc_audio'),
      EA.key('rtc_audio'),
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

scriptCompleted = true;
