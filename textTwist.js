var io;
var gameSocket;
var rooms = {};
const words = require("./lib/words.js")

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket, rooms) {
    io = sio;
    gameSocket = socket;
    // rooms = rooms;
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

}

function checkWord(data) {
    console.log("*** checkWord ***");
    let word = data.word.toLowerCase();
    console.log(word);

    let thisRoom = this.manager.rooms[data.gameId];

    if (!thisRoom.gameStarted) return

    let scoreBoard = thisRoom.scoreBoard;
    let wordData = thisRoom.wordData;

    let wordIndex = wordData.answers.indexOf(word);

    if (wordIndex !== -1 && !thisRoom.foundWords[word]) {
        scoreBoard[this.id].score += word.length;
        thisRoom.foundWords[word] = true;
    }

    console.log(scoreBoard)

    io.sockets.in(data.gameId).emit("wordChecked", {
        scoreBoard: scoreBoard,
        index: wordIndex,
        word: word
    })
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
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id, roomName: data.name});
    // Join the Room and wait for the players
    this.join(thisGameId.toString());
    // rooms = {}
    // rooms[data.gameId] = {}
    this.manager.rooms[thisGameId] = {
        foundWords: {},
        gameStarted: false,
        scoreBoard: {
            [this.id]: {
                name: data.name,
                score: 0
            },
        }
    }
    console.log(this.manager.rooms);
};

/*
 * All players have joined. Start the game!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(data) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : data.gameId,
        scoreBoard: this.manager.rooms[data.gameId].scoreBoard
    };
    console.log("All Players Ready. Preparing game...");
    console.log(this.manager.rooms[data.gameId].scoreBoard)
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    this.manager.rooms[gameId].gameStarted = true;
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
    var countdown = 10;
    setInterval(function() {
      countdown--;
      io.sockets.emit('timer', { countdown: countdown });
      if (countdown <= 0) {
        endGame.call(socket, gameId);
        clearInterval(this);
      }
    }, 1000);
};

function endGame(gameId) {
    console.log('inside endGame');
    this.manager.rooms[gameId].gameStarted = false;
    let scoreBoard = this.manager.rooms[gameId].scoreBoard;
    let winner = findWinner(scoreBoard);
    io.sockets.in(gameId).emit('endGame', { scoreBoard: scoreBoard, winner: winner });
}

function findWinner(scoreBoard) {
    let players = Object.keys(scoreBoard);
    if (scoreBoard[players[0]].score > scoreBoard[players[1]].score)
        return scoreBoard[players[0]].name;
    return scoreBoard[players[1]].name;
}

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data) {
    if(data.round < wordPool.length ){
        // Send a new set of words back to the host and players.
        sendWord.call(this, data.round, data.gameId);
    } else {
        // If the current round exceeds the number of words, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver',data);
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
    console.log('Player ' + data.playerName + ' attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);

        console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

        console.log(this.manager.rooms[data.gameId])

        this.manager.rooms[data.gameId].scoreBoard[this.id] = {
            name: data.playerName,
            score: 0
        },

        console.log(this.manager.rooms[data.gameId].scoreBoard)

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
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
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
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
    io.sockets.in(data.gameId).emit('newWordData', data);
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(gameId) {
    let randomWord = words.randomWord(7);
    let allWords = words.allWords(randomWord);

    var wordData = {
        // round: i,
        word : shuffle(randomWord.split("")).join("").toUpperCase(),   // Displayed Word
        answers : allWords, // Correct Answers
        allWordsLength : allWords.map(word => word.length), // Correct Answers
    };
    this.manager.rooms[gameId].wordData = wordData;
    return wordData;
}

/*
 * Javascript implementation of Fisher-Yates shuffle algorithm
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}