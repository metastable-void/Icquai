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

import * as sw from '../sw-register.js';
import './es-first-aid.js';
import { Console } from './console.js';
import { swNotificationClicked } from '../topics.js';

const console = new Console('Notification');

export const showNotification = async (title, options = {}) => {
  if (!options || 'object' != typeof options) {
    options = {};
  }
  if (!options.data) {
    options.data = {};
  }
  options.data.url = location.href;
  options.data.clientId = sw.getClientId();

  const notificationId = firstAid.getRandomUuid();
  options.data.notificationId = notificationId;

  // To support Safari < 16, encode data in icon url.
  options.icon = `/assets/img/fullsize-icon-256px.png?d=${encodeURIComponent(JSON.stringify(options.data))}`;
  const reg = await sw.getRegistration();
  if (reg && reg.showNotification) {
    await reg.showNotification(title, options);
    const notifications = await reg.getNotifications();
    for (const notification of notifications) {
      let data = notification.data;
      if (!data) {
        const iconUrl = new URL(notification.icon, location.href);
        const query = iconUrl.searchParams.get('d');
        try {
          if (!query) throw undefined;
          data = JSON.parse(query);
        } catch (e) {
          data = {};
        }
      }
      if (data.notificationId == notificationId) {
        console.info('Showed notification via ServiceWorker:', notification, data);
        return notification;
      }
    }
    throw new Error('Notification not found');
  } else {
    const notification = new Notification(title, options);
    const data = options.data;
    console.info('Showed notification:', notification, data);
    return notification;
  }
};
