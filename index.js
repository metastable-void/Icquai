// vim: ts=2 sw=2 et ai
/*
  Icquai: WebRTC peer-to-peer ephemeral chat in text and voice calls.
  Copyright (C) 2021. metastable-void and Menhera.org developers.

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
*/

require('dotenv').config();

const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8080;
const WSS_PATH = '/ws/';

const wss = new WebSocket.Server({
  noServer: true,
  path: WSS_PATH,
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  //
  ws.on('message', (data) => {
    if ('string' != typeof data) {
      console.warn('Invalid type of message');
      return;
    }
    try {
      const parsedData = JSON.parse(data);
      if (!parsedData) {
        throw void 0;
      }
      if (1 == parsedData.icquai_protocol) {
        
      }
    } catch (e) {
      console.warn('Invalid JSON received');
    }
    console.log('Message received: %s', data);
  });
});

server.listen(PORT, () => {
  console.log('Icquai server listening on port ' + PORT);
});
