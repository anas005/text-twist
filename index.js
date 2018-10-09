// Import the Express module
const express = require('express');

// Import the 'path' module (packaged with Node.js)
const path = require('path');

// Create a new instance of Express
const app = express();

// Import the Text Twist game file.
const textTwist = require('./textTwist');

// Create a Node.js based http server
const server = require('http').Server(app);

// Create a Socket.IO server and attach it to the http server
const io = require('socket.io')(server);

// Start listening on default port 8080
server.listen(process.env.PORT || 8080);

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.on('connection', function (socket) {
    console.log('client connected');
    textTwist.initGame(io, socket);
});
