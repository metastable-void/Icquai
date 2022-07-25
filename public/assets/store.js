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

import {Eternity} from "./lib/Eternity.js";
import { app } from './app.js';

export const store = app.getStore("store", (state) => {
  const drawerIsOpen = "drawerIsOpen" in state ? state.drawerIsOpen : false;
  const title = "title" in state ? state.title : 'Icquai';
  const headingText = "headingText" in state ? state.headingText : 'Home';
  return {
    ... state,
    urlPath: location.pathname,
    urlHash: '',
    urlQuery: '',
    online: navigator.onLine,
    webSocketIsOpen: false,
    webSocketStatus: 'CLOSED',
    wsRegistered: false,
    drawerIsOpen,
    title,
    headingText,
    myName: '',
    myFingerprint: '',
    myInviteLink: '',
    friendsInviteLink: '',
    friendsInviteNickname: '',
    friends: [],
    onlineFriends: [],
    openChannels: [],
    channelTexts: {},
  };
});
