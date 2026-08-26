/* eslint-disable no-console */

/**
 * Socket.IO event wiring. Called once per client connection.
 */

const store = require('./store');
const rooms = require('./rooms');
const rounds = require('./rounds');

/**
 * Register all game event handlers for a connected client.
 * @param {import('socket.io').Server} sio The Socket.IO server
 * @param {import('socket.io').Socket} socket The socket object for the client
 */
function initGame(sio, socket) {
  const ctx = {
    io: sio,
    socket,
    db: store.db,
    defaults: { WORD_LENGTH: store.WORD_LENGTH, TIME_LIMIT: store.TIME_LIMIT },
  };

  // On new connection
  socket.emit('connected', { message: 'You are connected!' });

  // Game events
  socket.on('getDefaultConfig', () => rounds.sendDefaultConfig(socket, ctx.defaults));
  socket.on('createNewGame', (data) => rooms.createNewGame(ctx, data));
  socket.on('startNewGame', (data) => rounds.prepareGame(ctx, data));
  socket.on('countdownFinished', (rawGameId) => rounds.hostStartGame(ctx, rawGameId));
  socket.on('joinGame', (data) => rooms.joinGame(ctx, data));
  socket.on('checkWord', (data) => rounds.checkWord(ctx, data));
  socket.on('restartGame', (data) => rounds.restartGame(ctx, data));
  socket.on('disconnecting', () => rooms.whileDisconnecting(ctx));

  // Error handling
  socket.on('error', (error) => {
    console.error(error);
  });
}

module.exports = {
  initGame,
};
