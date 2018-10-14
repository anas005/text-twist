/* eslint-disable no-console */

const { words, shuffle } = require('./lib');

/**
 * Globals
 */
let io;
let gameSocket;
const db = {};

/*
 * Default Configurations
 */
const WORD_LENGTH = 6;
const TIME_LIMIT = 120;


/* *******************************
   *                             *
   *       GAME FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * Reset the game
 * @param roomId The Game ID aka room ID
 */
function resetGame(roomId) {
  console.log('inside resetGame');
  db[roomId].gameStarted = false;
  delete db[roomId].scoreBoard[this.id];
  clearInterval(db[roomId].timer);

  // If both the players have left the room, destory the room!
  if (Object.keys(db[roomId].scoreBoard).length === 0) {
    delete db[roomId];
  } else {
    Object.keys(db[roomId].scoreBoard).forEach((id) => {
      db[roomId].scoreBoard[id].score = 0;
    });
    io.sockets.in(roomId).emit('resetGame', {
      gameId: roomId,
      mySocketId: this.id,
    });
  }
  console.log(db);
}

/**
 * Handler while a client is being disconnected
 * Clear the memory allocated for the client
 * Notify other player and Reset the game
 */
function whileDisconnecting() {
  console.log(`client ${this.id} is being disconnected`);

  if (db.clientRoom === undefined) return;
  const roomId = db.clientRoom[this.id];
  if (roomId === undefined) return;

  console.log(this.id, 'disconnected from', roomId);
  delete db.clientRoom[this.id];

  resetGame.call(this, roomId);
}

/**
 * All players have joined. Start the game!
 * @param gameId The game ID aka room ID
 */
function prepareGame(data) {
  const sock = this;
  const { scoreBoard } = db[data.gameId];
  const emitPayload = {
    mySocketId: sock.id,
    gameId: data.gameId,
    scoreBoard,
    timeLimit: db[data.gameId].config.timeLimit,
  };
  console.log('gonna begin new game');
  io.sockets.in(data.gameId).emit('beginNewGame', emitPayload);
}

/**
 * Restart the game
 * @param data {{ gameId: int }}
 */
function restartGame(data) {
  const room = db[data.gameId];
  if (room === undefined) {
    this.emit('startNewGame', {});
    return;
  }
  room.foundWords = {};
  room.gameStarted = true;
  room.wordData = {};
  Object.keys(room.scoreBoard).forEach((id) => {
    room.scoreBoard[id].score = 0;
  });
  prepareGame.call(this, data);
}

function sendDefaultConfig() {
  this.emit('defaultConfig', { wordLength: WORD_LENGTH, timeLimit: TIME_LIMIT });
}

/**
 * Create a new game
 * @param data {{ name: string, wordLength: number, timeLimit: number }}
 */
function createNewGame(data) {
  // Create a unique Socket.IO Room
  const thisGameId = Math.floor(Math.random() * 100000);

  // create a client room map
  db.clientRoom = db.clientRoom || {};
  db.clientRoom[this.id] = thisGameId;

  // Return the Room ID (gameId) and the socket ID (mySocketId) to the client
  this.emit('newGameCreated', { gameId: thisGameId, mySocketId: this.id });
  // Join the Room and wait for the players
  this.join(thisGameId.toString());

  db[thisGameId] = {
    foundWords: {},
    gameStarted: false,
    scoreBoard: {
      [this.id]: {
        name: data.name,
        score: 0,
      },
    },
    config: {
      wordLength: data.wordLength || WORD_LENGTH,
      timeLimit: data.timeLimit || TIME_LIMIT,
    },
  };
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 * @param gameId The Game ID
 * @returns {{ word: string, allWordsLength: array }}
 */
function getWordData(gameId) {
  const randomWord = words.randomWord(db[gameId].config.wordLength);
  const allWords = words.allWords(randomWord);
  const wordData = {
    word: shuffle(randomWord.split('')).join('').toUpperCase(), // Displayed Word
    answers: allWords, // Correct Answers
    allWordsLength: allWords.map(word => word.length), // Correct Answers
  };
  db[gameId].wordData = wordData;
  return wordData;
}

/**
 * Get a word for the host, and a list of words for the player.
 * @param gameId The room identifier
 */
function sendWord(gameId) {
  const data = getWordData.call(this, gameId);
  io.sockets.in(gameId).emit('newWordData', {
    word: data.word,
    allWordsLength: data.allWordsLength,
  });
}

/**
 * Find the winner by analysing the Scoreboard
 * @param scoreBoard The score board
 * @returns {{ name: string, id: string }}
 */
function findWinner(scoreBoard) {
  const players = Object.keys(scoreBoard);
  const player0 = scoreBoard[players[0]];
  const player1 = scoreBoard[players[1]];

  const winner = player0.score > player1.score
    ? { name: player0.name, id: players[0] }
    : { name: player1.name, id: players[1] };

  return player0.score === player1.score ? {} : winner;
}

/**
 * End the game and send the game result to clients
 * @param gameId The Game ID
 */
function endGame(gameId) {
  console.log('inside endGame');
  const { scoreBoard, timer } = db[gameId];
  clearInterval(timer);
  db[gameId].gameStarted = false;
  const winner = findWinner(scoreBoard);
  console.log('scoreBoard', scoreBoard);
  console.log('winner', winner);
  io.sockets.in(gameId).emit('endGame', {
    scoreBoard,
    winner: winner.name,
    winnerID: winner.id,
  });
}

/**
 * Check the word sent by client
 * @param data {{ word: string, gameId: int }}
 */
function checkWord(data) {
  console.log('*** checkWord ***');
  const word = data.word.toLowerCase();
  const thisRoom = db[data.gameId];
  const { wordData, gameStarted, foundWords } = thisRoom;

  if (!thisRoom || !gameStarted) return;

  const wordIndex = wordData.answers.indexOf(word);
  const emitPayload = { word, index: wordIndex };

  emitPayload.socketId = this.id;
  if (wordIndex === -1) {
    emitPayload.incorrectWord = true;
  } else if (foundWords[word] === true) {
    emitPayload.alreadyTaken = true;
  } else {
    const { scoreBoard } = thisRoom;
    scoreBoard[this.id].score += word.length;
    console.log(scoreBoard);
    foundWords[word] = true;
    emitPayload.scoreBoard = scoreBoard;
  }

  io.sockets.in(data.gameId).emit('wordChecked', emitPayload);

  if (Object.keys(foundWords).length === wordData.answers.length) {
    endGame.call(this, data.gameId);
  }
}

/**
 * Start the countdown timer
 * @param gameId The Game ID
 */
function startTimer(gameId) {
  console.log('inside startTimer');
  const socket = this;
  let countdown = db[gameId].config.timeLimit;
  const timer = setInterval(() => {
    countdown -= 1;
    io.sockets.in(gameId).emit('timer', { countdown });
    if (countdown <= 0) {
      endGame.call(socket, gameId);
    }
  }, 1000);
  db[gameId].timer = timer;
}

/**
 * Countdown finished and the game begins!
 * @param gameId The Game ID
 */
function hostStartGame(gameId) {
  console.log('Game Started.');
  db[gameId].gameStarted = true;
  sendWord.call(this, gameId);
  startTimer.call(this, gameId);
}

/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data {{ gameId: int, playerName: string }}
 */
function joinGame(data) {
  // A reference to the player's Socket.IO socket object
  const sock = this;

  // Look up the room ID in the Socket.IO adapter object.
  const room = gameSocket.adapter.rooms[data.gameId];

  // If the room exists...
  if (room !== undefined) {
    // attach the socket id to the emitPayload object.
    const emitPayload = data;
    emitPayload.mySocketId = sock.id;

    db.clientRoom[sock.id] = data.gameId;

    // Join the room
    sock.join(data.gameId);

    console.log(`Player ${data.playerName} joining game: ${data.gameId}`);

    // Emit an event notifying the clients that the player has joined the room.
    io.sockets.in(data.gameId).emit('guestJoinedRoom', emitPayload);

    db[data.gameId].scoreBoard[this.id] = {
      name: data.playerName,
      score: 0,
    };

    console.log(db[data.gameId].scoreBoard);
  } else {
    // Otherwise, send an error message back to the player.
    this.emit('errorMessage', { message: 'This room does not exist.' });
  }
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

/**
 * This function is called by index.js to initialize a new game instance.
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
function initGame(sio, socket) {
  io = sio;
  gameSocket = socket;

  // On new connection
  gameSocket.emit('connected', { message: 'You are connected!' });

  // Game events
  gameSocket.on('getDefaultConfig', sendDefaultConfig);
  gameSocket.on('createNewGame', createNewGame);
  gameSocket.on('startNewGame', prepareGame);
  gameSocket.on('countdownFinished', hostStartGame);
  gameSocket.on('joinGame', joinGame);
  gameSocket.on('checkWord', checkWord);
  gameSocket.on('restartGame', restartGame);
  gameSocket.on('disconnecting', whileDisconnecting);

  // Error handling
  gameSocket.on('error', (error) => { console.error(error); });
}

module.exports = {
  initGame,
};
