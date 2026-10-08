/* eslint-disable no-console */

// Import the Express module
const express = require('express');

// Import the 'path' module (packaged with Node.js)
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Create a new instance of Express
const app = express();

// Create a Node.js based http server
const server = require('http').Server(app);

// Create a Socket.IO server and attach it to the http server
const io = require('socket.io')(server);

// Import the game logic.
const textTwist = require('./game');

const port = process.env.PORT || 8080;

// App version = sha1 over every file under public/, injected into sw.js
// so any deploy with changed client files changes the worker bytes
// (which is what triggers a PWA update). Identical redeploys keep the
// same version, so clients are never nagged spuriously.
function collectFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectFiles(full, out);
      else if (entry.isFile()) out.push(full);
    });
  return out;
}

function getAppVersion() {
  try {
    const digest = crypto.createHash('sha1');
    const root = path.join(__dirname, 'public');
    collectFiles(root, []).forEach((full) => {
      digest.update(path.relative(__dirname, full));
      digest.update(fs.readFileSync(full));
    });
    return `content-${digest.digest('hex').slice(0, 8)}`;
  } catch (err) {
    return 'dev';
  }
}

const APP_VERSION = getAppVersion();
console.log(`app version: ${APP_VERSION}`);
server.listen(port, '0.0.0.0', () => {
  console.log(`server listening on http://0.0.0.0:${port}  (LAN: http://192.168.1.16:${port})`);
});

// Serve sw.js with the content hash injected: the browser treats any byte
// change as a new worker version, which drives the update toast.
// Must come before express.static so this handler wins for /sw.js.
app.get('/sw.js', (req, res) => {
  const file = fs.readFileSync(path.join(__dirname, 'public', 'sw.js'), 'utf8');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(file.split('__APP_VERSION__').join(APP_VERSION));
});

// Debug endpoint: confirms which version the server is stamping.
app.get('/version', (req, res) => {
  res.json({ version: APP_VERSION });
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
