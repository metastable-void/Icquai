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

import { Eternity } from './lib/Eternity.js';
import { app } from './app.js';

// global topics

export const wsOpen = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.open');
export const wsConnecting = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.connecting');
export const wsClosed = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.closed');
export const wsMessageReceived = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.message.received');
export const wsRegistered = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.registered');
export const wsMessageSend = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'ws.message.send');
export const becomingOnline = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'network.online');
export const becomingOffline = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'network.offline');
export const becomingVisible = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.visible');
export const becomingHidden = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.hidden');
export const becomingInteractive = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.interactive');
export const pageShow = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.show');
export const pageNavigate = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'page.navigate');
export const myNameChange = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'my.name.change');
export const myFingerprintChange = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'my.fingerprint.change');
export const myInviteLinkChange = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'my.invite_link.change');
export const friendsInviteLinkChange = app.getTopic(Eternity.TOPIC_SCOPE_SESSION, 'friends.invite_link.change');


// global event listeners

document.addEventListener('DOMContentLoaded', ev => {
  becomingInteractive.dispatch(null);
});

window.addEventListener('pageshow', ev => {
  pageShow.dispatch(null);
});

window.addEventListener('popstate', (ev) => {
  pageNavigate.dispatch(location.href);
});

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
