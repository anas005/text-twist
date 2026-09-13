/* eslint-disable no-console */

// Import the Express module
const express = require('express');

// Import the 'path' module (packaged with Node.js)
const path = require('path');

// Create a new instance of Express
const app = express();

// Create a Node.js based http server
const server = require('http').Server(app);

// Create a Socket.IO server and attach it to the http server
const io = require('socket.io')(server);

// Import the game logic.
const textTwist = require('./game');

const port = process.env.PORT || 8080;
server.listen(port, '0.0.0.0', () => {
  console.log(`server listening on http://0.0.0.0:${port}  (LAN: http://192.168.1.16:${port})`);
});

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  },
}));

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.on('connection', (socket) => {
  console.log(`client ${socket.id} connected`);
  textTwist.initGame(io, socket);
});
