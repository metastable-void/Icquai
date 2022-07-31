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
import * as sw from "./sw-register.js";
import "./lib/adapter.js";
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
  callStart,
  callEnd,
  updateCallMuted,
  ringingBegin,
  ringingEnd,
  encryptedMessageReceived,
  displayImages,
  fileReceived,
} from "./topics.js";

const ed = nobleEd25519;

const HISTORY_BUFFER_LENGTH = 10;
const CLIENT_SRC_REPOSITORY = 'https://github.com/metastable-void/Icquai';
const SERVER_SRC_REPOSITORY = 'https://github.com/metastable-void/icquai-server';
const RING_TIMEOUT = 30000;
const FILE_CHUNK_SIZE = 8192; // in bytes
const FILE_CHUNK_COUNT = 128;

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
const themeColorStore = new LocalStorageData('icquai.theme.accent_color', () => '#3B9EA3');
const myNumberStore = new LocalStorageData('icquai.my.number', () => {
  let number = '';
  for (let i = 0; i < 8; i++) {
    number += Math.min(9, Math.floor(firstAid.random()*10));
  }
  return number;
});

/**
 * @type {RTCPeerConnection?}
 */
 globalThis.pc = null;

 /**
  * @type {RTCDataChannel?}
  */
 globalThis.dataChannel = null;

 let verboseMessageLogging = false;

 globalThis.enableMessageLogging = () => {
  verboseMessageLogging = true;
 };

 globalThis.disableMessageLogging = () => {
  verboseMessageLogging = false;
 };
 
const getMyNumber = () => {
  const rawNumber = myNumberStore.getValue();
  return rawNumber.slice(0, 4) + '-' + rawNumber.slice(4);
};

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
 * Call this only on user click.
 * TODO: subscribe push as well
 */
const requestNotificationPermission = async () => {
  if (!window.Notification) {
    console.warn('Notification not supported');
  } else if (Notification.permission == 'granted') {
    console.log('Notification already granted');
  } else if (Notification.permission == 'denied') {
    console.log('Notification already denied by user');
  } else {
    const permission = await Notification.requestPermission();
    if (permission == 'granted') {
      const notification = new Notification('Notification enabled!', {
        body: 'You are in full control of which notification is shown.',
        requireInteraction: false,
      });
    } else if (permission == 'denied') {
      console.log('Notification just denied by user');
    }
  }
};

const notificationAllowed = () => {
  if (!window.Notification) {
    console.warn('Notification not supported');
    return false;
  } else if (Notification.permission == 'granted') {
    return true;
  }
  return false;
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
  const myName = myNameStore.getValue();
  validPingNonces.add(nonce);
  const message = {
    type: 'ping',
    nonce,
    name: myName,
  };
  await wsForwardMessage(base64PublicKey, message);
  setTimeout(() => {
    validPingNonces.delete(nonce);
  }, PING_TIMEOUT);
};

/**
 * @type {HTMLAudioElement}
 */
let ringAudio;
globalThis.ringStart = () => {
  console.log('ringing start');
  ringAudio = new Audio('/assets/sounds/ring_jp.wav');
  ringAudio.loop = true;
  ringAudio.play();
};

globalThis.ringEnd = () => {
  console.log('ringing end');
  ringAudio.pause();
  ringAudio.currentTime = 0;
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
    sessionId: app.sessionId,
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
  if (!base64PublicKey) {
    throw new Error('Public key must be specified');
  }
  const json = JSON.stringify(message);
  const state = store.state;
  if (state.callOngoing == base64PublicKey && dataChannel && dataChannel.readyState == 'open') {
    dataChannel.send(json);
    return;
  }
  const data = firstAid.encodeString(json);
  const keyBytes = sharedSecretMap.get(base64PublicKey);
  if (!keyBytes) {
    throw new Error(`Shared secret not found for public key '${base64PublicKey}'`);
  }
  const encryptedMessage = await encrypt(data, keyBytes);
  await wsForwardMessage(base64PublicKey, encryptedMessage);
};

globalThis.isDataChannelAvailable = (base64PublicKey) => {
  const state = store.state;
  if (state.callOngoing == base64PublicKey && dataChannel && dataChannel.readyState == 'open') {
    return true;
  } else {
    return false;
  }
};

/**
 * For file transfer.
 * @param {string} base64PublicKey 
 * @returns {boolean}
 */
globalThis.isBufferLow = (base64PublicKey) => {
  const state = store.state;
  if (state.callOngoing == base64PublicKey && dataChannel && dataChannel.readyState == 'open') {
    return dataChannel.bufferedAmount < 1;
  } else if (ws) {
    return ws.bufferedAmount < 1;
  } else {
    return false;
  }
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
    console.info(`Navigate: '%s' => '%s'`, location.href, url.href);
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
  //const audioElement = document.querySelector('#rtc_audio');
  /*try {
    audioElement.play();
  } catch (e) {
    console.warn(e);
  }*/
  reconnectAudio().catch((e) => {
    console.error(e);
  });
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
    if (message.type != 'signed_envelope' && verboseMessageLogging) {
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
        //console.warn('Message sent to %s bounced:', message.recipient, message.message);
        const recipient = message.recipient;
        friendBecomingOffline.dispatch(message.recipient);
        (async () => {
          const {publicKey, payload} = await verifyMessage(message.message);
          const myKeys = await getMyKeys();
          const myPublicKey = firstAid.encodeBase64(myKeys.publicKey);
          if (myPublicKey != publicKey) {
            console.error('Bounced message not signed by my key');
            return;
          }
          if ('forward' == payload.type) {
            const message = payload.payload;
            console.warn('Bounced message to %s:', recipient, message);
          }
        })().catch((e) => {
          console.error(e);
        });
        break;
      }
      case 'signed_envelope': {
        (async () => {
          const {publicKey, payload} = await verifyMessage(message);
          if ('forward' == payload.type) {
            const message = payload.payload;
            if (verboseMessageLogging) {
              console.log('Message from %s:', publicKey, message);
            }
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
                const friends = friendsStore.getValue();
                let friendFound = false;
                for (const friend of friends) {
                  if (publicKey == friend.publicKey) {
                    friendFound = true;
                    if (friend.savedName != message.name && message.name) {
                      console.log('Received ping from %s, name: %s => %s', publicKey, friend.savedName, message.name);
                      friend.savedName = message.name;
                    }
                  }
                }
                friendsStore.setValue(friends);
                break;
              }
              case 'pong': {
                if (!validPingNonces.has(message.nonce)) {
                  console.warn('Invalid nonce in ping');
                  break;
                }
                validPingNonces.delete(message.nonce);
                friendBecomingOnline.dispatch(publicKey);
                if (!message.name) {
                  break;
                }
                const friends = friendsStore.getValue();
                let friendFound = false;
                for (const friend of friends) {
                  if (publicKey == friend.publicKey) {
                    friendFound = true;
                    if (friend.savedName != message.name && message.name) {
                      console.log('Received pong from %s, name: %s => %s', publicKey, friend.savedName, message.name);
                      friend.savedName = message.name;
                    }
                  }
                }
                /*
                // commented out because at this state friends need not be added and confusing (name not set yet, etc.)
                if (!friendFound) {
                  console.log('Received pong and learned friend: %s, name: %s', publicKey, message.name);
                  const friend = {
                    nickname: message.name,
                    savedName: message.name,
                    publicKey,
                  };
                  friends.push(friend);
                }
                */
                friendsStore.setValue(friends);
                break;
              }
              case 'kex_ping': {
                console.log('Received kex ping, ponging.');
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
                console.log('Shared secret set for %s', publicKey);
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
                console.log('Received kex pong.');
                const sessionId = message.peerSessionId;
                const savedSessionId = sessionIdMap.get(publicKey);
                if (savedSessionId && savedSessionId != message.sessionId) {
                  console.log('Unmatching peer session id, ignoring key exchange...');
                }
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
                console.log('Shared secret set for %s', publicKey);
                sessionIdMap.set(publicKey, message.sessionId);
                channelOpened.dispatch(publicKey);
                break;
              }
              case 'encrypted_envelope': {
                const sharedSecret = sharedSecretMap.get(publicKey);
                if (message.sessionId) {
                  const savedSessionId = sessionIdMap.get(publicKey);
                  if (savedSessionId != message.sessionId) {
                    console.log('Unmatching peer session id, ignoring signed message...');
                    break;
                  }
                }
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
                if (verboseMessageLogging) {
                  console.log('encrypted message from %s:', publicKey, payload);
                }
                encryptedMessageReceived.dispatch({
                  publicKey,
                  message: payload,
                });
                break;
              }
              case 'ch_rst': {
                console.log('Received encrypted channel reset');
                const peerSessionId = sessionIdMap.get(publicKey);
                if (!peerSessionId) {
                  break;
                }
                if (message.sessionId == peerSessionId) {
                  sharedSecretMap.delete(publicKey);
                  console.log('Shared secret removed for %s', publicKey);
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

/**
 * @typedef {{startTime: number, publicKey: string, transaction_id: string, file_id: string, file_name: string, file_type: string, total_size: number, total_chunks: number, chunks: Uint8Array[], blob: Blob?, url: string}} FileTransfer
 */

/**
 * @type {Map<string, Map<string, FileTransfer>>}
 */
const receivingFileTransfers = new Map;

const callAcceptanceTokens = new Map; // <public key> => <token>

encryptedMessageReceived.addListener(async ({publicKey, message}) => {
  const payload = message;
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
    case 'ring': {
      console.log('Received call');
      ringStart();
      ringingBegin.dispatch(publicKey);
      setTimeout(() => {
        ringEnd();
        ringingEnd.dispatch(null);
      }, RING_TIMEOUT);
      break;
    }
    case 'ring_accept': {
      console.log('Ringing call accepted');
      ringEnd();
      ringingEnd.dispatch(null);
      const acceptanceToken = payload.acceptance_token;
      createCall(publicKey, true, acceptanceToken).catch((e) => {
        console.error(e);
      });
      break;
    }
    case 'rtc_init': {
      console.log('Received RTC init');
      const acceptanceToken = payload.acceptance_token;
      const savedToken = callAcceptanceTokens.get(publicKey);
      if (!savedToken || acceptanceToken != savedToken) {
        console.error('Call acceptance token mismatch, denying');
        break;
      }
      callAcceptanceTokens.delete(publicKey);
      ringingEnd.dispatch(null);
      ringEnd();
      createCall(publicKey, false).catch((e) => {
        console.error(e);
      });
      break;
    }
    case 'rtc_ice_candidate': {
      if (verboseMessageLogging) {
        console.log('RTC: Received ice candidate:', payload.candidate);
      }
      rtcIceCandidate.dispatch(payload.candidate);
      break;
    }
    case 'rtc_description': {
      if (verboseMessageLogging) {
        console.log('RTC: Received RTC description:', payload.description);
      }
      rtcDescription.dispatch(payload.description);
      break;
    }
    case 'rtc_hangup': {
      console.log('Received hangup message');
      hangup();
      break;
    }
    case 'file_chunk': {
      if (!receivingFileTransfers.has(publicKey)) {
        receivingFileTransfers.set(publicKey, new Map);
      }
      const transfers = receivingFileTransfers.get(publicKey);
      if (!transfers.has(payload.file_id)) {
        if (payload.chunk_index != 0) {
          console.error('Chunk not starting at 0');
          break;
        }
        transfers.set(payload.file_id, {
          startTime: getTime(),
          publicKey: publicKey,
          transaction_id: payload.transaction_id,
          file_id: payload.file_id,
          file_name: payload.file_name,
          file_type: payload.file_type,
          total_size: payload.total_size,
          total_chunks: payload.total_chunks,
          chunks: [],
          blob: null,
          url: '',
        });
        const transfer = transfers.get(payload.file_id);
        console.info('File receiving:', transfer);
      }
      const transfer = transfers.get(payload.file_id);
      const data = firstAid.decodeBase64(payload.data);
      transfer.chunks.push(data);
      if (payload.chunk_index == (payload.total_chunks - 1)) {
        if (transfer.chunks.length != transfer.total_chunks) {
          console.error('missing or duplicate chunks, not recoverable at now');
          transfers.delete(payload.file_id);
          break;
        }
        const blob = new Blob(transfer.chunks, {
          type: transfer.file_type,
        });
        transfer.chunks.length = 0;
        transfer.blob = blob;
        transfers.delete(payload.file_id);
        transfer.url = URL.createObjectURL(transfer.blob);
        const endTime = getTime();
        const duration = endTime - transfer.startTime;
        console.info('File received in %f s:', duration / 1000, transfer);
        fileReceived.dispatch(transfer);
      }
      break;
    }
    default: {
      console.warn('Unknown message from %s:', publicKey, payload);
      break;
    }
  }
});

ringingBegin.addListener((base64PublicKey) => {
  const friends = friendsStore.getValue();
  let callingFriend;
  for (const value of friends) {
    if (value.publicKey == base64PublicKey) {
      callingFriend = value;
      break;
    }
  }
  const callingFriendName = callingFriend ? callingFriend.savedName : 'Unknown friend';
  if (notificationAllowed()) {
    const notification = new Notification('Call incoming', {
      body: callingFriendName,
      requireInteraction: true,
      renotify: true,
      tag: 'notification-call-incoming',
      data: {
        url: location.href,
        clientId: sw.getClientId(),
      },
    });
    notification.addEventListener('click', (ev) => {
      window.focus();
      notification.close();
      ringAccept(base64PublicKey).catch((e) => {
        console.error(e);
      });
    });
  }
});


store.subscribe(ringingBegin, (state, publicKey) => {
  return {
    ... state,
    ringing: publicKey,
  };
});

store.subscribe(ringingEnd, (state, _action) => {
  return {
    ... state,
    ringing: null,
  };
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

store.subscribe(fileReceived, (state, aTransfer) => {
  /**
   * @type {FileTransfer}
   */
  const transfer = aTransfer;
  // preview images
  if ((transfer.file_type == 'image/png' || transfer.file_type == 'image/jpeg') && transfer.total_size < 10000000) {
    const imageUrls = [];
    const url = transfer.url;
    imageUrls.push(url);

    const {imagesShown} = state;
    imagesShown[transfer.publicKey] = imageUrls;
    return {
      ... state,
      imagesShown,
    };
  }
  const {filesReceived} = state;
  const {publicKey} = transfer;
  if (!(publicKey in filesReceived)) {
    filesReceived[publicKey] = [];
  }
  filesReceived[publicKey].push({
    fileName: transfer.file_name,
    fileType: transfer.file_type,
    fileSize: transfer.total_size,
    url: transfer.url,
  });
  return {
    ... state,
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
  const {imagesShown} = state;
  const {filesReceived} = state;
  const set = new Set(openChannels);
  set.delete(publicKey);
  const imageUrls = imagesShown[publicKey];
  if (imageUrls) {
    for (const url of imageUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    }
  }
  const files = filesReceived[publicKey];
  if (files) {
    for (const file of files) {
      try {
        URL.revokeObjectURL(file.url);
      } catch (e) {}
    }
  }
  delete imagesShown[publicKey];
  delete filesReceived[publicKey];
  return {
    ... state,
    openChannels: [... set],
    imagesShown,
    filesReceived,
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

store.subscribe(callStart, (state, base64PublicKey) => {
  return {
    ... state,
    callOngoing: base64PublicKey,
  };
});

store.subscribe(callEnd, (state, _action) => {
  return {
    ... state,
    callOngoing: null,
  };
});

store.subscribe(updateCallMuted, (state, muted) => {
  return {
    ... state,
    callMuted: !!muted,
  };
});

store.subscribe(displayImages, (state, {publicKey, images: aImages}) => {
  const images = [... aImages].map((str) => String(str));
  const {imagesShown} = state;
  imagesShown[publicKey] = images;
  return {
    ... state,
    imagesShown,
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
  const link = new URL(`/invite?s=${encodeURIComponent(firstAid.encodeBase64(bytes))}`, location.href).href;
  myInviteLinkChange.dispatch(link);
};

myNameStore.observe(inviteLinkObserver);
privateKeyStore.observe(inviteLinkObserver);

friendsStore.observe((friends) => {
  friendsChange.dispatch(friends);
});

themeColorStore.observe((color) => {
  document.documentElement.style.setProperty('--theme-accent-color', color);
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

const createInputTextarea = (label, id, eventListeners) => {
  const input = EH.div([EA.classes(['input-field'])], [
    EH.label([EP.attribute('for', id)], [EH.text(label)]),
    EH.customTag('icquai-textarea', [
      EA.id(id),
      ... eventListeners,
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

const reloadPage = () => {
  console.info('Reloading page');
  location.reload();
};

const getAudio = async () => {
  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
};

/**
 * @type {MediaStream?}
 */
let mediaStream = null;

const createCall = async (base64PublicKey, selfInitiated, acceptanceToken) => {
  hangup();
  const audioElement = document.querySelector('#rtc_audio');
  const configuration = {
    iceServers: [
      {
        urls: 'stun:stun1.l.google.com:19302',
      },
      {
        urls: 'stun:stun2.l.google.com:19302',
      },
    ],
  };

  if (selfInitiated) {
    await sendEncryptedMessage(base64PublicKey, {
      type: 'rtc_init',
      acceptance_token: acceptanceToken,
    });
  }

  const pc = new RTCPeerConnection(configuration);
  globalThis.pc = pc;

  pc.onicecandidate = ({candidate}) => {
    console.log('RTC: onicecandidate');
    sendEncryptedMessage(base64PublicKey, {
      type: 'rtc_ice_candidate',
      candidate,
    }).catch((e) => {
      console.error(e);
    });
  };

  pc.onnegotiationneeded = async () => {
    try {
      console.log('RTC: onnegotiationneeded, creating offer');
      await pc.setLocalDescription(await pc.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: false}));
      await sendEncryptedMessage(base64PublicKey, {
        type: 'rtc_description',
        description: pc.localDescription,
      });
    } catch (e) {
      console.error(e);
    }
  };

  pc.ontrack = (event) => {
    console.log('RTC: got remote stream');
    if (audioElement.srcObject == event.streams[0]) {
      return;
    }
    audioElement.srcObject = event.streams[0];
    console.log('RTC: Set srcObject:', event.streams[0]);
    audioElement.play();
    callStart.dispatch(base64PublicKey);
  };

  let connectionState = pc.connectionState;
  pc.onconnectionstatechange = (ev) => {
    console.log('RTC connection state change: %s => %s', connectionState, pc.connectionState);
    connectionState = pc.connectionState;
    if (pc.connectionState == 'disconnected' || pc.connectionState == 'failed') {
      console.log('RTC: Call is ended');
      hangup();
    }
  };

  pc.ondatachannel = (ev) => {
    globalThis.dataChannel = ev.channel;
    dataChannel.binaryType = 'arraybuffer';
    dataChannel.onclose = (ev) => {
      globalThis.dataChannel = null;
    };
    dataChannel.addEventListener('message', (ev) => {
      if ('string' == typeof ev.data) {
        try {
          const message = JSON.parse(ev.data);
          if (verboseMessageLogging) {
            console.log('RTC: DataChannel: Message received:', message);
          }
          encryptedMessageReceived.dispatch({
            publicKey: base64PublicKey,
            message: message,
          });
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  rtcIceCandidate.addListener(async (candidate) => {
    console.log('RTC: Received ICE candidate');
    if (pc.connectionState == 'closed') {
      return;
    }
    await pc.addIceCandidate(candidate);
  });

  rtcDescription.addListener(async (description) => {
    if (description.type == 'offer') {
      await pc.setRemoteDescription(description);
      console.log('RTC: Set offer description');
      const stream = await getAudio();
      mediaStream = stream;
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
      console.log('RTC: Set answer description');
    }
  });

  if (selfInitiated) {
    globalThis.dataChannel = pc.createDataChannel('data_channel');
    dataChannel.binaryType = 'arraybuffer';
    dataChannel.onclose = (ev) => {
      globalThis.dataChannel = null;
    };
    dataChannel.addEventListener('message', (ev) => {
      if ('string' == typeof ev.data) {
        try {
          const message = JSON.parse(ev.data);
          if (verboseMessageLogging) {
            console.log('RTC: DataChannel: Message received:', message);
          }
          encryptedMessageReceived.dispatch({
            publicKey: base64PublicKey,
            message: message,
          });
        } catch (e) {
          console.error(e);
        }
      }
    });
    const stream = await getAudio();
    mediaStream = stream;
    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }
  return pc;
};

const reconnectAudio = async () => {
  if (!pc) {
    console.log('Not in call');
    return;
  }
  if (pc.connectionState != 'connected') {
    console.log('Call not connected');
    return;
  }
  let enabled = true;
  if (mediaStream) {
    mediaStream.getAudioTracks().forEach((track) => {
      enabled = track.enabled;
    });
  }
  const stream = await getAudio();
  mediaStream = stream;
  console.log('RTC: reconnecting audio');
  stream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
    pc.addTrack(track, stream);
  });
};

const toggleMute = async () => {
  if (!mediaStream) {
    return;
  }
  const audioTracks = mediaStream.getAudioTracks();
  if (audioTracks[0].enabled) {
    console.log('RTC: Muting the audio track');
    audioTracks[0].enabled = false;
    updateCallMuted.dispatch(true);
  } else {
    console.log('RTC: Unmuting the audio track');
    audioTracks[0].enabled = true;
    updateCallMuted.dispatch(false);
  }
};

const getMuted = async () => {
  if (!mediaStream) {
    return false;
  }
  const audioTracks = mediaStream.getAudioTracks();
  return !audioTracks[0].enabled;
};

setInterval(async () => {
  const muted = await getMuted();
  updateCallMuted.dispatch(muted);
}, 1000);

const hangup = () => {
  const state = store.state;
  const {callOngoing} = state;
  if (callOngoing) {
    sendEncryptedMessage(callOngoing, {
      type: 'rtc_hangup',
    }).catch((e) => {
      console.error(e);
    });
  }
  callEnd.dispatch(null);
  if (mediaStream) {
    console.log('Closing MediaStream');
    mediaStream.getTracks().forEach((track) => {
      track.stop();
    });
    mediaStream = null;
  }
  if (!globalThis.dataChannel && !globalThis.pc) {
    return;
  }
  console.info('RTC: Closing connection:', globalThis.pc);
  if (globalThis.dataChannel) {
    globalThis.dataChannel.close();
  }
  globalThis.dataChannel = null;
  if (globalThis.pc) {
    globalThis.pc.close();
  }
  globalThis.pc = null;
};

const callRing = async (base64PublicKey) => {
  ringStart();
  setTimeout(() => {
    ringEnd();
  }, RING_TIMEOUT);
  await sendEncryptedMessage(base64PublicKey, {
    type: 'ring',
    name: myNameStore.getValue(),
  });
};

const ringAccept = async (base64PublicKey) => {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const acceptanceToken = firstAid.encodeBase64(tokenBytes);
  callAcceptanceTokens.set(base64PublicKey, acceptanceToken);
  await sendEncryptedMessage(base64PublicKey, {
    type: 'ring_accept',
    name: myNameStore.getValue(),
    acceptance_token: acceptanceToken,
  });
};

const isDataChannelOpen = () => {
  if (!dataChannel) {
    return false;
  }
  return dataChannel.readyState == 'open';
};

const createToast = (text, actionText, actionEventListeners) => {
  return EH.div([
    EA.classes(['toast']),
  ], [
    EH.button([
      ... actionEventListeners,
    ], [EH.text(actionText)]),
    EH.div([
      EA.classes(['toast-text']),
    ], [EH.text(text)]),
  ]);
};

/**
 * Send file(s) to the specified user.
 * @param {string} base64PublicKey 
 * @param {FileList} files 
 */
const sendFiles = async (base64PublicKey, files) => {
  //
  console.info('Sending files to %s:', base64PublicKey, files);
  
  // preview images
  const imageUrls = [];
  for (const file of files) {
    if ((file.type == 'image/png' || file.type == 'image/jpeg') && file.size < 10000000) {
      const url = URL.createObjectURL(file);
      imageUrls.push(url);
    }
  }
  if (imageUrls.length > 0) {
    displayImages.dispatch({
      publicKey: base64PublicKey,
      images: imageUrls,
    });
  }
  const startTime = getTime();
  let fileIndex = 0;
  const transactionId = firstAid.getRandomUuid();
  for (const file of files) {
    console.log('Sending file:', file);
    const chunkCount = Math.ceil(file.size / FILE_CHUNK_SIZE);
    let sentChunks = 0;
    const fileId = firstAid.getRandomUuid();
    for (let i = 0, chunkIndex = 0; i < file.size; i += FILE_CHUNK_SIZE, chunkIndex++) {
      const slice = file.slice(i, i + FILE_CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      await sendEncryptedMessage(base64PublicKey, {
        type: 'file_chunk',
        transaction_id: transactionId,
        file_id: fileId,
        file_name: file.name,
        file_type: file.type,
        file_count: files.length,
        file_index: fileIndex,
        total_size: file.size,
        total_chunks: chunkCount,
        chunk_index: chunkIndex,
        data: firstAid.encodeBase64(buffer),
      });
      sentChunks++;
      if (sentChunks < FILE_CHUNK_COUNT) {
        continue;
      }
      sentChunks = 0;
      while (!isBufferLow(base64PublicKey)) {
        await new Promise((res) => setTimeout(res, 10));
      }
    }
    fileIndex++;
  }
  const endTime = getTime();
  console.log('%d file(s) sent in %f s', files.length, (endTime - startTime) / 1000);
};

let callButtonPressed = false;
const containerElement = document.querySelector('#container');
store.render(containerElement, async (state) => {
  const query = new URLSearchParams(state.urlQuery);
  const hash = state.urlHash;
  let mainHeader;
  let mainContent;
  const notFound = () => {
    mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Not Found')]);
    mainContent = EH.div([
      EA.classes(['profile']),
      EP.key('view-404'),
    ], [
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
        EP.attribute('placeholder', 'Input your name'),
      ], 'name');
      const inviteLink = createInputField('Invite Link', 'my-invite-link', [
        EP.attribute('readonly', ''),
        EP.attribute('value', state.myInviteLink),
      ], '');
      const myNumber = createInputField('My number', 'my-number', [
        EP.attribute('readonly', ''),
        EP.attribute('value', getMyNumber()),
      ], '');
      mainContent = EH.div([
        EA.classes(['profile']),
        EP.key('view-my-profile'),
      ], [
        EH.p([], [EH.text('Please set your name.')]),
        fingerprint,
        name,
        myNumber,
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
        let hashContent = String(hash).slice(1);
        const query = new URLSearchParams(state.urlQuery);
        if (!hashContent) {
          hashContent = query.get('s');
        }
        const bytes = firstAid.decodeBase64(hashContent);
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
        mainContent = EH.div([
          EA.classes(['profile']),
          EP.key('view-invite'),
        ], [
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
      mainContent = EH.div([
        EA.classes(['profile']),
        EP.key('view-friends'),
      ], [
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
                pageNavigate.dispatch(`/invite${url.search}${url.hash}`);
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
        let imageElements = [];
        let downloadElements = [];
        if (publicKey in state.imagesShown) {
          const images = state.imagesShown[publicKey];
          for (const imageUrl of images) {
            imageElements.push(EH.img([
              EP.attribute('src', imageUrl),
              EA.classes(['talk-image']),
            ]));
          }
        }
        if (publicKey in state.filesReceived) {
          const downloads = state.filesReceived[publicKey];
          for (const download of downloads) {
            const downloadElement = EH.a([
              EA.classes(['talk-download']),
              EP.attribute('download', download.fileName),
              EP.attribute('href', download.url),
            ], [
              EH.span([
                EA.classes(['material-icons']),
              ], [EH.text('file_download')]),
              EH.span([], [EH.text(`${download.fileName} (${download.fileSize}B, ${download.fileType})`)]),
            ]);
            downloadElements.push(downloadElement);
          }
        }
        channelStatus = EH.div([
          EA.id('channel-status'),
        ], [
          EH.div([
            EA.id('talk-images'),
          ], [
            ... imageElements,
          ]),
          EH.div([
            EA.id('talk-downloads'),
          ], [
            ... downloadElements,
          ]),
          EH.p([], [EH.text('Chat is open.')]),
          EH.p([], [
            EH.button([
              EP.eventListener('click', (ev) => {
                //
                sharedSecretMap.delete(publicKey);
                console.log('Shared secret removed for %s', publicKey);
                channelClosed.dispatch(publicKey);
                wsForwardMessage(publicKey, {
                  type: 'ch_rst',
                  sessionId: app.sessionId,
                }).catch((e) => {
                  console.error(e);
                });
              }),
            ], [EH.text('Close chat')]),
          ]),
          EH.p([], [
            EH.input([
              EA.id('talk-input-file'),
              EP.attribute('type', 'file'),
              EP.attribute('multiple', ''),
              EP.style('display', 'none'),
              EP.eventListener('change', (ev) => {
                /**
                 * @type {FileList}
                 */
                const files = ev.target.files;
                sendFiles(publicKey, [... files]).catch((e) => {
                  console.error(e);
                });
                ev.target.value = '';
              }),
            ]),
            EH.button([
              EA.classes(['material-icons']),
              EP.eventListener('click', (ev) => {
                const fileInput = document.querySelector('#talk-input-file');
                fileInput.click();
              }),
            ], [EH.text('upload_file')]),
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
          EA.classes(['material-icons', state.callOngoing ? 'call-active' : 'call-inactive']),
          EP.eventListener('click', (ev) => {
            //
            if (callButtonPressed) {
              console.log('Call button repeatedly pressed, ignoring.');
              return;
            }
            callButtonPressed = true;
            setTimeout(() => {
              callButtonPressed = false;
            }, 1000);
            if (state.openChannels.includes(publicKey)) {
              // initiate call
              if (state.callOngoing) {
                hangup();
              } else if (globalThis.pc) {
                console.log('RTC: Call connecting; hanging up.');
                hangup();
              } else if (state.ringing) {
                ringAccept(state.ringing).catch((e) => {
                  console.error(e);
                });
              } else {
                callRing(publicKey).catch((e) => {
                  console.error(e);
                });
              }
            } else {
              const channelOpenedCallback = (openedChannelPublicKey) => {
                if (openedChannelPublicKey != publicKey) {
                  console.log('Ignoring unrelated channel open');
                  return;
                }
                channelOpened.removeListener(channelOpenedCallback);
                console.log('Automatically calling after reconnection');
                callRing(publicKey).catch((e) => {
                  console.error(e);
                });
              };
              channelOpened.addListener(channelOpenedCallback);
              setTimeout(() => {
                channelOpened.removeListener(channelOpenedCallback);
              }, 5000);
              sendKexPing(publicKey).catch((e) => {
                console.error(e);
              });
            }
          }),
        ], [EH.text(state.callOngoing ? 'call_end' : 'call')]),
      ]);
      const toasts = [];
      if ("Notification" in window && Notification.permission == 'default') {
        const toast = createToast('Allow notifications to get notified about new messages.', 'Allow', [
          EP.eventListener('click', (ev) => {
            requestNotificationPermission().catch((e) => {
              console.error(e);
            });
          }),
        ]);
        toasts.push(toast);
      }
      if (state.ringing) {
        let callingFriend;
        for (const value of state.friends) {
          if (value.publicKey == state.ringing) {
            callingFriend = value;
            break;
          }
        }
        const callingFriendName = callingFriend ? callingFriend.savedName : 'Unknown friend';
        const toast = createToast('Incoming call from ' + callingFriendName, 'Accept', [
          EP.eventListener('click', (ev) => {
            pageNavigate.dispatch(`/talk?public_key=${encodeURIComponent(state.ringing)}`);
            ringAccept(state.ringing).catch((e) => {
              console.error(e);
            });
          })
        ]);
        toasts.push(toast);
      }

      let muteStatus;
      if (state.callOngoing) {
        muteStatus = EH.div([
          EA.classes(['call-mute-status'])
        ], [
          EH.button([
            EA.eventListener('click', (ev) => {
              toggleMute().catch((e) => {
                console.log(e);
              });
            }),
            EA.classes(['material-icons']),
          ], [EH.text(state.callMuted ? 'mic_off' : 'mic')]),
          EH.button([
            EA.eventListener('click', (ev) => {
              reconnectAudio().catch((e) => {
                console.log(e);
              });
            }),
            EA.classes(['material-icons']),
          ], [EH.text('refresh')]),
        ]);
      } else {
        muteStatus = EH.div([
          EA.classes(['call-mute-status'])
        ], []);
      }
      mainContent = EH.div([
        EA.classes(['talk']),
        EP.key('view-talk'),
        EP.eventListener('dragenter', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
        }),
        EP.eventListener('dragover', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
        }),
        EP.eventListener('drop', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          const dt = ev.dataTransfer;
          if (!dt) {
            return;
          }
          const files = dt.files;
          if (!files) {
            return;
          }
          console.log('File dropped');
          sendFiles(publicKey, files).catch((e) => {
            console.error(e);
          });
        }),
      ], [
        ... toasts,
        muteStatus,
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
    case '/settings': {
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Settings')]);
      const themeColor = themeColorStore.getValue();
      const uaField = createInputTextarea('User agent', 'settings-ua', [
        EP.attribute('value', navigator.userAgent),
        EP.attribute('readonly', ''),
      ]);
      const sessionIdField = createInputTextarea('Session ID', 'settings-session-id', [
        EP.attribute('value', app.sessionId),
        EP.attribute('readonly', ''),
      ]);
      const clientIdField = createInputTextarea('Client ID', 'settings-client-id', [
        EP.attribute('value', app.clientId),
        EP.attribute('readonly', ''),
      ]);
      mainContent = EH.div([
        EA.classes(['profile']),
        EP.key('view-settings'),
      ], [
        EH.p([], [
          EH.button([
            EP.eventListener('click', (ev) => {
              reloadPage();
            }),
          ], [EH.text('Reload app...')]),
        ]),
        EH.p([], [
          EH.text('Color theme: '),
          EH.select([
            EP.eventListener('change', (ev) => {
              themeColorStore.setValue(ev.target.value);
            }),
          ], [
            EH.option([
              EP.attribute('value', '#3b9ea3'),
              EP.attribute(themeColor == '#3b9ea3' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('cyan')]),
            EH.option([
              EP.attribute('value', '#5eaf30'),
              EP.attribute(themeColor == '#5eaf30' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('green')]),
            EH.option([
              EP.attribute('value', '#b777d5'),
              EP.attribute(themeColor == '#b777d5' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('violet')]),
            EH.option([
              EP.attribute('value', '#e460b3'),
              EP.attribute(themeColor == '#e460b3' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('pink')]),
            EH.option([
              EP.attribute('value', '#d87551'),
              EP.attribute(themeColor == '#d87551' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('orange')]),
            EH.option([
              EP.attribute('value', '#4a96d1'),
              EP.attribute(themeColor == '#4a96d1' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('blue')]),
            EH.option([
              EP.attribute('value', '#909090'),
              EP.attribute(themeColor == '#909090' ? 'selected' : 'data-not-selected', ''),
            ], [EH.text('grey')]),
          ]),
        ]),
        EH.h2([], [EH.text('System information')]),
        uaField,
        clientIdField,
        sessionIdField,
      ]);
      break;
    }
    case '/help': {
      mainHeader = EH.h2([EP.classes(['header-headding'])], [EH.text('Help')]);
      mainContent = EH.div([
        EA.classes(['profile']),
        EP.key('view-help'),
      ], [
        EH.h2([], [EH.text('Icquai')]),
        EH.p([], [EH.text(`
          Future of realtime communication realized.
        `)]),
        EH.table([], [
          EH.tbody([], [
            EH.tr([], [
              EH.th([], [EH.text('Codename')]),
              EH.th([], [EH.text('(Modern) Japanese')]),
              EH.th([], [EH.text('Late Middle Japanese')]),
            ]),
            EH.tr([], [
              EH.td([], [
                EH.text('Icquai '),
                EH.sup([], [
                  EH.text('[1]')
                ])
              ]),
              EH.td([], [EH.text('一会 (いっかい) /ˈiQkai/')]),
              EH.td([], [
                EH.text('/iQkwai/ '),
                EH.sup([], [
                  EH.text('[citation needed]')
                ])
              ]),
            ]),
          ]),
        ]),
        EH.p([], [EH.text(`
          Source: [1] Hōyaku Nippo jisho (1980), p.330.
        `)]),
        EH.table([], [
          EH.tbody([], [
            EH.tr([], [
              EH.th([], [EH.text('Language')]),
              EH.th([], [EH.text('(Original) Meaning(s)')]),
            ]),
            EH.tr([], [
              EH.td([], [EH.text('English')]),
              EH.td([], [EH.text('Meeting just once / a moment')]),
            ]),
            EH.tr([], [
              EH.td([], [EH.text('Japanese')]),
              EH.td([], [EH.text('「一度だけ会うこと。ただ一度の対面」「しばらく。わずかな時間」')]),
            ]),
          ]),
        ]),
        EH.p([], [
          EH.text('Naming is done by '),
          EH.a([
            EP.attribute('href', 'https://github.com/MAJUKYI'),
          ], [EH.text('@MAJUKYI')]),
          EH.text('.'),
        ]),
        EH.h2([], [EH.text('Terms of use')]),
        EH.ol([], [
          EH.li([], [EH.text(
            `You agree to avoid any use of this service which make its continued development difficult, including but not limited to: illegal use and denial of service attacks.`
          )]),
          EH.li([], [EH.text(
            `This service is provided as-is and no warranty of service quality is provided.`
          )]),
        ]),
        EH.h2([], [EH.text('Privacy policy')]),
        EH.ol([], [
          EH.li([], [EH.text(
            `We do not store any of your private data. Your (handle) name and public key is transmitted to the server and used for allowing communication between users.`
          )]),
          EH.li([], [EH.text(
            `Your communication is end-to-end encrypted where possible and we have no access to it.`
          )]),
        ]),
        EH.h2([], [EH.text('License')]),
        EH.p([], [
          EH.text(`
            Icquai: WebRTC peer-to-peer ephemeral chat in text and voice calls.
          `)
        ]),
        EH.p([], [
          EH.text(`
            Copyright © 2022. metastable-void and Menhera.org developers.
          `)
        ]),
        EH.p([], [
          EH.text(`
            This program is free software: you can redistribute it and/or modify
            it under the terms of the GNU Affero General Public License as published
            by the Free Software Foundation, either version 3 of the License, or
            (at your option) any later version.
          `)
        ]),
        EH.p([], [
          EH.text(`
            This program is distributed in the hope that it will be useful,
            but WITHOUT ANY WARRANTY; without even the implied warranty of
            MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
            GNU Affero General Public License for more details.
          `)
        ]),
        EH.p([], [
          EH.text(`
            You should have received a copy of the GNU Affero General Public License
            along with this program.  If not, see <https://www.gnu.org/licenses/>.
          `)
        ]),
        EH.h2([], [EH.text('Source code')]),
        EH.p([], [
          EH.text('Client: '),
          EH.a([
            EP.attribute('href', CLIENT_SRC_REPOSITORY),
          ], [EH.text(CLIENT_SRC_REPOSITORY)]),
        ]),
        EH.p([], [
          EH.text('Server: '),
          EH.a([
            EP.attribute('href', SERVER_SRC_REPOSITORY),
          ], [EH.text(SERVER_SRC_REPOSITORY)]),
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
      EA.attribute('autoplay', ''),
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
