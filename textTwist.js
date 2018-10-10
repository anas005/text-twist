const { words, shuffle } = require("./lib")
let io;
let gameSocket;
let db = {};
const WORD_LENGTH = 5;
const TIME_LIMIT = 20;

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
function initGame(sio, socket) {
    io = sio;
    gameSocket = socket;

    // On new connection
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostStartNewGame', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);

    gameSocket.on('checkWord', checkWord);

    gameSocket.on('restartGame', restartGame);

    gameSocket.on('disconnecting', whileDisconnecting);

    // gameSocket.on('disconnect', resetGame);

}

function whileDisconnecting(...args) {
    if (db.clientRoom === undefined) return;
    const roomId = db.clientRoom[this.id];
    if (roomId === undefined) return;

    console.log(this.id, 'disconnected from', roomId);
    delete db.clientRoom[this.id];

    resetGame.call(this, roomId);
}

function findRoomByClientId(rooms, id) {
    let room;
    Object.keys(rooms).filter(roomId => roomId !== '').forEach((roomId) => {
        if (rooms[roomId] && rooms[roomId].indexOf(id) !== -1) {
            room = roomId;
        }
    });
    return room && room.replace(/^\//, '');
}

function resetGame(roomId) {
    debugger;
    console.log('inside resetGame');
    db[roomId].gameStarted = false;
    console.log('Gonna clear scoreBoard', db[roomId].scoreBoard[this.id]);
    delete db[roomId].scoreBoard[this.id];
    Object.keys(db[roomId].scoreBoard).forEach(id => {
        db[roomId].scoreBoard[id].score = 0;
    });
    clearInterval(db[roomId].timer);
    io.sockets.in(roomId).emit('resetGame', { gameId: roomId, mySocketId: this.id });
}

function restartGame(data) {
    const room = db[data.gameId];
    room.foundWords = {};
    room.gameStarted = true;
    room.wordData = {};
    Object.keys(room.scoreBoard).forEach(id => {
        room.scoreBoard[id].score = 0;
    });
    hostPrepareGame.call(this, data);
}

function checkWord(data) {
    console.log("*** checkWord ***");
    let word = data.word.toLowerCase();
    // debugger;
    let thisRoom = db[data.gameId];

    if (!thisRoom.gameStarted) return;

    let wordData = thisRoom.wordData;

    let wordIndex = wordData.answers.indexOf(word);

    const emitPaylad = { word, index: wordIndex };

    if (wordIndex === -1) {
        emitPaylad.incorrectWord = true;
    } else if (thisRoom.foundWords[word] === true) {
        emitPaylad.alreadyTaken = true;
    } else {
        let scoreBoard = thisRoom.scoreBoard;
        scoreBoard[this.id].score += word.length;

        console.log(scoreBoard);

        thisRoom.foundWords[word] = true;
        const scorer = "player" + (Object.keys(scoreBoard).indexOf(this.id) + 1);
        emitPaylad.scoreBoard = scoreBoard;
        emitPaylad.scorer = scorer;
    }

    io.sockets.in(data.gameId).emit("wordChecked", emitPaylad);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame(data) {
    // Create a unique Socket.IO Room
    var thisGameId = (Math.random() * 100000) | 0;

    // create a client room map
    db.clientRoom = db.clientRoom || {};
    db.clientRoom[this.id] = thisGameId;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
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
            timeLimit: data.timeLimit || TIME_LIMIT
        }
    }
    console.log(db);
};

/*
 * All players have joined. Start the game!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(data) {
    var sock = this;
    var scoreBoard = db[data.gameId].scoreBoard;
    data = {
        mySocketId: sock.id,
        gameId: data.gameId,
        scoreBoard: scoreBoard,
        timeLimit: db[data.gameId].config.timeLimit
    };
    console.log("gonna begin new game")
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    db[gameId].gameStarted = true;
    sendWord.call(this, 0, gameId);
    startTimer.call(this, gameId);
};

/*
 * The Countdown timer
 * @param gameId The game ID / room ID
 */
function startTimer(gameId) {
    console.log('inside startTimer');
    let socket = this;
    var countdown = db[gameId].config.timeLimit;
    const timer = setInterval(function () {
        countdown--;
        io.sockets.in(gameId).emit('timer', { countdown: countdown });
        if (countdown <= 0) {
            endGame.call(socket, gameId);
            clearInterval(this);
        }
    }, 1000);
    db[gameId].timer = timer;
};

function endGame(gameId) {
    console.log('inside endGame');
    db[gameId].gameStarted = false;
    let scoreBoard = db[gameId].scoreBoard;
    let winner = findWinner(scoreBoard);
    console.log("scoreBoard", scoreBoard);
    console.log("winner", winner);
    io.sockets.in(gameId).emit('endGame', { scoreBoard: scoreBoard, winner: winner.name, winnerID: winner.id });
}

function findWinner(scoreBoard) {
    let players = Object.keys(scoreBoard);
    let player0 = scoreBoard[players[0]],
        player1 = scoreBoard[players[1]];
    let winner = player0.score > player1.score ? { name: player0.name, id: players[0] } : { name: player1.name, id: players[1] };
    return player0.score == player1.score ? {} : winner;
}

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data) {
    if (data.round < wordPool.length) {
        // Send a new set of words back to the host and players.
        sendWord.call(this, data.round, data.gameId);
    } else {
        // If the current round exceeds the number of words, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver', data);
    }
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
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.adapter.rooms[data.gameId];

    // If the room exists...
    if (room != undefined) {
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        db.clientRoom[sock.id] = data.gameId;

        // Join the room
        sock.join(data.gameId);

        console.log('Player ' + data.playerName + ' joining game: ' + data.gameId);

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

        // console.log(db[data.gameId]);

        db[data.gameId].scoreBoard[this.id] = {
            name: data.playerName,
            score: 0
        };

        console.log(db[data.gameId].scoreBoard);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error', { message: "This room does not exist." });
    }
}

/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
    // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

    // The player's answer is attached to the data object.  \
    // Emit an event with the answer so it can be checked by the 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
    // console.log('Player: ' + data.playerName + ' ready for new game.');

    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

/**
 * Get a word for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
function sendWord(wordPoolIndex, gameId) {
    var data = getWordData.call(this, gameId);
    io.sockets.in(gameId).emit('newWordData', data);
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(gameId) {
    let randomWord = words.randomWord(db[gameId].config.wordLength);
    let allWords = words.allWords(randomWord);
    // debugger;
    var wordData = {
        // round: i,
        word: shuffle(randomWord.split("")).join("").toUpperCase(),   // Displayed Word
        answers: allWords, // Correct Answers
        allWordsLength: allWords.map(word => word.length), // Correct Answers
    };
    db[gameId].wordData = wordData;
    return wordData;
}

module.exports = {
    initGame
};