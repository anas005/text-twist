/**
 * Round gameplay: word selection, timer, answer checking, game end.
 *
 * Every handler receives a context object:
 *   { io, socket, db, defaults }
 */

const { words, shuffle } = require('../lib');

/**
 * Send the stored default configuration to the client.
 * @param socket The requesting socket
 * @param defaults {{ WORD_LENGTH: number, TIME_LIMIT: number }}
 */
function sendDefaultConfig(socket, defaults) {
  socket.emit('defaultConfig', {
    wordLength: defaults.WORD_LENGTH,
    timeLimit: defaults.TIME_LIMIT,
  });
}

/**
 * All players are in. Announce the new game to the room.
 * @param ctx {{ io, socket, db }}
 * @param data {{ gameId: int }}
 */
function prepareGame(ctx, data) {
  const { io, socket, db } = ctx;
  const room = db[data.gameId];
  if (!room) return;
  room.awaitingCountdown = true;
  room.gameStarted = false;
  const { scoreBoard } = room;
  const emitPayload = {
    mySocketId: socket.id,
    gameId: data.gameId,
    scoreBoard,
    timeLimit: room.config.timeLimit,
  };
  io.sockets.in(String(data.gameId)).emit('beginNewGame', emitPayload);
}

/**
 * Restart the current game (fresh word, zeroed scores).
 * @param ctx {{ io, socket, db }}
 * @param data {{ gameId: int }}
 */
function restartGame(ctx, data) {
  const { socket, db } = ctx;
  const room = db[data.gameId];
  if (room === undefined) {
    socket.emit('startNewGame', {});
    return;
  }
  // Both players clicking Play Again emits twice — collapse into one restart.
  if (room.awaitingCountdown) return;
  clearInterval(room.timer);
  room.timer = null;
  room.foundWords = {};
  room.awaitingCountdown = true;
  room.gameStarted = false;
  room.wordData = {};
  Object.keys(room.scoreBoard).forEach((id) => {
    room.scoreBoard[id].score = 0;
  });
  prepareGame(ctx, data);
}

/**
 * Build the round's word data: shuffled display word,
 * all valid sub-words and their definitions.
 * @param room The room record from the store
 * @returns {{ word: string, answers: string[], allWordsLength: number[], definitions: object }}
 */
// eslint-disable-next-line no-param-reassign
function getWordData(room) {
  const randomWord = words.randomWord(room.config.wordLength);
  const allWords = words.allWords(randomWord);
  const wordData = {
    word: shuffle(randomWord.split('')).join('').toUpperCase(),
    answers: allWords,
    allWordsLength: allWords.map((word) => word.length),
    definitions: words.definitionsFor(allWords),
  };
  // eslint-disable-next-line no-param-reassign
  room.wordData = wordData;
  return wordData;
}

/**
 * Pick a word and send it (with answers/definitions) to the room.
 * @param ctx {{ io, db }}
 * @param gameId The room identifier
 */
function sendWord(ctx, gameId) {
  const { io, db } = ctx;
  const data = getWordData(db[gameId]);
  io.sockets.in(gameId).emit('newWordData', {
    word: data.word,
    allWordsLength: data.allWordsLength,
    answers: data.answers,
    definitions: data.definitions,
  });
}

/**
 * Find the winner by analysing the scoreboard.
 * @param scoreBoard The score board
 * @returns {{ name: string, id: string }}
 */
function findWinner(scoreBoard) {
  const players = Object.keys(scoreBoard);
  if (players.length === 0) return {};
  if (players.length === 1) {
    return scoreBoard[players[0]].score > 0
      ? { name: scoreBoard[players[0]].name, id: players[0] }
      : {};
  }

  const player0 = scoreBoard[players[0]];
  const player1 = scoreBoard[players[1]];

  const winner = player0.score > player1.score
    ? { name: player0.name, id: players[0] }
    : { name: player1.name, id: players[1] };

  return player0.score === player1.score ? {} : winner;
}

/**
 * End the game and send the result (plus full reveal) to clients.
 * @param ctx {{ io, db }}
 * @param gameId The Game ID
 */
function endGame(ctx, gameId) {
  const { io, db } = ctx;
  const room = db[gameId];
  if (!room || (room.gameStarted === false && !room.timer)) return;
  const {
    scoreBoard, timer, wordData, foundWords,
  } = room;
  clearInterval(timer);
  room.timer = null;
  room.gameStarted = false;
  room.awaitingCountdown = false;
  const winner = findWinner(scoreBoard);
  io.sockets.in(gameId).emit('endGame', {
    scoreBoard,
    winner: winner.name,
    winnerID: winner.id,
    answers: wordData ? wordData.answers : [],
    foundWords,
  });
}

/**
 * Check a submitted word against the round's answers.
 * @param ctx {{ io, socket, db }}
 * @param data {{ word: string, gameId: int }}
 */
function checkWord(ctx, data) {
  const { io, socket, db } = ctx;

  if (!data || data.gameId === undefined || data.word === undefined) return;
  const word = String(data.word).toLowerCase();
  const thisRoom = db[data.gameId];

  if (!thisRoom || !thisRoom.gameStarted) return;

  const { wordData, foundWords } = thisRoom;
  if (!wordData || !wordData.answers) return;

  const wordIndex = wordData.answers.indexOf(word);
  const emitPayload = { word, index: wordIndex, socketId: socket.id };

  if (wordIndex === -1) {
    emitPayload.incorrectWord = true;
  } else if (foundWords[word] === true) {
    emitPayload.alreadyTaken = true;
  } else {
    thisRoom.scoreBoard[socket.id].score += word.length;
    foundWords[word] = true;
    emitPayload.scoreBoard = thisRoom.scoreBoard;
  }

  io.sockets.in(String(data.gameId)).emit('wordChecked', emitPayload);

  if (Object.keys(foundWords).length === wordData.answers.length) {
    endGame(ctx, data.gameId);
  }
}

/**
 * Start the per-room countdown timer.
 * @param ctx {{ io, db }}
 * @param gameId The Game ID
 */
function startTimer(ctx, gameId) {
  const { io, db } = ctx;
  clearInterval(db[gameId].timer);
  let countdown = db[gameId].config.timeLimit;
  const timer = setInterval(() => {
    countdown -= 1;
    io.sockets.in(gameId).emit('timer', { countdown });
    if (countdown <= 0) {
      endGame(ctx, gameId);
    }
  }, 1000);
  db[gameId].timer = timer;
}

/**
 * Countdown finished — flip the room into "started" state.
 * @param ctx {{ io, socket, db }}
 * @param rawGameId The Game ID in whatever form the client sent it
 */
function hostStartGame(ctx, rawGameId) {
  const gameId = String(rawGameId);
  const room = ctx.db[gameId];
  if (!room) return;
  // Duplicate countdownFinished (overlapping client countdowns) — ignore.
  if (room.gameStarted && !room.awaitingCountdown) return;
  room.awaitingCountdown = false;
  room.gameStarted = true;
  sendWord(ctx, gameId);
  startTimer(ctx, gameId);
}

module.exports = {
  sendDefaultConfig,
  prepareGame,
  restartGame,
  getWordData,
  sendWord,
  findWinner,
  endGame,
  checkWord,
  startTimer,
  hostStartGame,
};
