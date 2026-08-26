/**
 * Room lifecycle: creation, joining, resets and disconnect cleanup.
 *
 * Every handler receives a context object:
 *   { io, socket, db, defaults }
 */

/**
 * Create a new game room.
 * @param ctx {{ io, socket, db, defaults }}
 * @param data {{ name: string, wordLength: number, timeLimit: number }}
 */
function createNewGame(ctx, data) {
  const { socket, db, defaults } = ctx;

  // Create a unique Socket.IO Room
  const gameId = Math.floor(Math.random() * 100000);

  // create a client room map
  db.clientRoom = db.clientRoom || {};
  db.clientRoom[socket.id] = gameId.toString();

  // Return the Room ID (gameId) and the socket ID (mySocketId) to the client
  socket.emit('newGameCreated', { gameId, mySocketId: socket.id });

  // Join the Room and wait for the players
  socket.join(gameId.toString());

  db[gameId] = {
    foundWords: {},
    gameStarted: false,
    scoreBoard: {
      [socket.id]: { name: data.name, score: 0 },
    },
    config: {
      wordLength: data.wordLength || defaults.WORD_LENGTH,
      timeLimit: data.timeLimit || defaults.TIME_LIMIT,
    },
  };
}

/**
 * A player joins an existing room by game ID.
 * @param ctx {{ io, socket, db }}
 * @param data {{ gameId: int, playerName: string }}
 */
function joinGame(ctx, data) {
  const { io, socket, db } = ctx;

  // Look up the room ID in the Socket.IO adapter object.
  const roomId = String(data.gameId);
  const room = socket.adapter.rooms.get(roomId);

  if (room !== undefined) {
    const emitPayload = data;
    emitPayload.mySocketId = socket.id;

    db.clientRoom[socket.id] = roomId;

    // Join the room
    socket.join(roomId);

    // Notify everyone in the room that the player has joined.
    io.sockets.in(roomId).emit('guestJoinedRoom', emitPayload);

    db[data.gameId].scoreBoard[socket.id] = {
      name: data.playerName,
      score: 0,
    };
  } else {
    // Otherwise, send an error message back to the player.
    socket.emit('errorMessage', { message: 'This room does not exist.' });
  }
}

/**
 * Reset the game room after a player leaves or asks for a restart.
 * @param ctx {{ io, socket, db }}
 * @param roomId The Game ID aka room ID
 */
function resetGame(ctx, roomId) {
  const { io, socket, db } = ctx;

  if (!db[roomId]) return;
  db[roomId].gameStarted = false;
  delete db[roomId].scoreBoard[socket.id];
  clearInterval(db[roomId].timer);

  // If both the players have left the room, destroy the room!
  if (Object.keys(db[roomId].scoreBoard).length === 0) {
    delete db[roomId];
  } else {
    Object.keys(db[roomId].scoreBoard).forEach((id) => {
      db[roomId].scoreBoard[id].score = 0;
    });
    io.sockets.in(roomId).emit('resetGame', {
      gameId: roomId,
      mySocketId: socket.id,
    });
  }
}

/**
 * Handler while a client is being disconnected.
 * Clears memory allocated for the client, notifies the other
 * player and resets the game.
 * @param ctx {{ io, socket, db }}
 */
function whileDisconnecting(ctx) {
  const { socket, db } = ctx;

  if (db.clientRoom === undefined) return;
  const roomId = db.clientRoom[socket.id];
  if (roomId === undefined) return;

  delete db.clientRoom[socket.id];

  resetGame(ctx, roomId);
}

module.exports = {
  createNewGame,
  joinGame,
  resetGame,
  whileDisconnecting,
};
