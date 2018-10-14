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

// Import the Text Twist game file.
const textTwist = require('./textTwist');

// Start listening on $PORT or default port 8080
const port = process.env.PORT || 8080;
server.listen(port);
console.log(`server started listening on ${port}`);

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.on('connection', (socket) => {
  console.log(`client ${socket.id} connected`);
  textTwist.initGame(io, socket);
});
