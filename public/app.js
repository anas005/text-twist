/* eslint-env jquery */
/* eslint-env browser */
/* global io:true */
/* global FastClick:true */
/* global textFit:true */

/* eslint-disable no-param-reassign */
/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* eslint-disable no-console */
/* eslint-disable no-alert */

jQuery(function fn($) {
  $.fn.insertAt = function insertAt(index, $parent) {
    return this.each(function onEach() {
      if (index === 0) {
        $parent.prepend(this);
      } else {
        $parent.children().eq(index - 1).after(this);
      }
    });
  };

  const App = {

    /**
     * The Socket.IO socket object identifier. This is unique for
     * each player and host. It is generated when the browser initially
     * connects to the server when the page loads for the first time.
     */
    mySocketId: '',

    /* *************************************
       *                Setup              *
       ************************************* */

    /**
     * This runs when the page initially loads.
     */
    init() {
      App.cacheElements();
      App.showInitScreen();
      App.bindEvents();

      // Initialize the fastclick library
      FastClick.attach(document.body);
    },

    /**
     * Create references to on-screen elements used throughout the game.
     */
    cacheElements() {
      App.$doc = $(document);

      // Templates
      App.$gameArea = $('#gameArea');
      App.$templateIntroScreen = $('#intro-screen-template').html();
      App.$templateNewGame = $('#create-game-template').html();
      App.$templateJoinGame = $('#join-game-template').html();
      App.$templateGameBoard = $('#game-board-template').html();
      App.$hostGame = $('#host-game-template').html();
    },

    /**
     * Create some click handlers for the various buttons that appear on-screen.
     */
    bindEvents() {
      App.$doc.on('keydown', App.handleKeyPress);

      // Host
      App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);
      App.$doc.on('click', '#btnCreateRoom', App.Host.onCreateRoomClick);
      App.$doc.on('click', '#btnStart', App.Host.onStartClick);

      // Guest
      App.$doc.on('click', '#btnJoinGame', App.Guest.onJoinClick);
      App.$doc.on('click', '#btnReady', App.Guest.onGuestReadyClick);

      // Common
      App.$doc.on('input', 'input[type=range]', App.updateRangeText);
      App.$doc.on('click', '#shuffle', App.shuffleLetters);
      App.$doc.on('click', '#check', App.checkWord);
      App.$doc.on('click', '#recall', App.recallLetters);
      App.$doc.on('click', '#playAgain', App.playAgain);
      App.$doc.on('click', '#mainTable td:not(.empty), #shuffledTable td:not(.empty)', App.handleLetterClick);
    },

    /* *************************************
       *             Game Logic            *
       ************************************* */

    /**
     * Show the initial Text-Twist Title Screen
     * (with Start and Join buttons)
     */
    showInitScreen() {
      App.$gameArea.html(App.$templateIntroScreen);
      App.doTextFit('.title');
    },

    /**
     * Generate Game Board with given word
     */
    generateBoard(word, allWordsLength) {
      const mainRow = $('#mainTable tr').empty();
      const shuffledRow = $('#shuffledTable tr').empty();

      for (let i = 0; i < word.length; i += 1) {
        mainRow.append($('<td></td>').addClass('empty'));
        shuffledRow.append($('<td></td>').addClass('letter').text(word[i]));
      }

      $('#allWords').empty();
      allWordsLength.forEach((length) => {
        const table = $('<table></table>');
        const row = $('<tr></tr>').append('<td></td>'.repeat(length));
        table.append(row);
        $('#allWords').append(table);
      });
    },

    /**
     * Handle keyboard keys.
     * A-Z         -> Send characters to Main table
     * <ENTER>     -> Send the word to server to check.
     * <SPACE>     -> Shuffles the characters
     * <BACKSPACE> -> Removes the last entered character
     */
    handleKeyPress(e) {
      if (!$('#gameArea #wordArea').is(':visible')) {
        return true;
      }

      if (e.keyCode === 13) { // ENTER KEY
        $('#check').click();
        return;
      }
      const $target = $(e.target || e.srcElement);
      if (e.keyCode === 8 && !$target.is('input,[contenteditable="true"],textarea')) { // BACKSPACE KEY
        e.preventDefault();
        $('#mainTable .letter:last').click();
        return;
      }
      if (e.keyCode === 32) { // SPACEBAR
        $('#shuffle').click();
      }
      const key = String.fromCharCode(e.keyCode);
      if ((/^[a-z]$/i).test(key)) { // A-Z KEYS
        $('#shuffledTable .letter').each(function iterator() {
          if ($(this).text() === key) {
            $(this).click();
            return false;
          }
        });
      }
    },

    /**
     * Updates scoreboard
     */
    updateScoreBoard(scoreBoard) {
      const socketIds = Object.keys(scoreBoard);
      $('.playerScore').each(function iterator(index) {
        $(this).data('socketID', socketIds[index]);
        $(this).find('.score').text(scoreBoard[socketIds[index]].score);
        $(this).find('.playerName').text(scoreBoard[socketIds[index]].name);
      });
    },

    /*
     * Javascript implementation of Fisher-Yates shuffle algorithm
     *  http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
     */
    shuffle(array) {
      let currentIndex = array.length;
      let temporaryValue;
      let randomIndex;

      // While there remain elements to shuffle...
      while (currentIndex !== 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }

      return array;
    },

    updateRangeText() {
      const slider = $(this);
      $(`#${slider.data('for')}`).text(slider.val());
    },

    /**
     * Shuffle letters present in hot board
     */
    shuffleLetters() {
      const letters = $('#shuffledTable td').toArray();
      App.shuffle(letters);
      for (let i = 0; i < letters.length; i += 1) {
        $('#shuffledTable tr').append(letters[i]);
      }
    },

    /**
     * send the entered word to server
     */
    checkWord() {
      IO.socket.emit('checkWord', { word: $('#mainTable .letter').text(), gameId: App.gameId });
    },

    /**
     * Recall all the entered letters
     */
    recallLetters() {
      $('#mainTable .letter').each(function iterator() {
        App.swap($(this), $('#shuffledTable .empty:eq(0)'));
      });
    },

    /**
     * Swap two DOM elements
     */
    swap(e1, e2) {
      const e1Index = e1.index();
      const e2Index = e2.index();
      const e1Parent = e1.parent();
      const e2Parent = e2.parent();
      e1.insertAt(e2Index, e2Parent);
      e2.insertAt(e1Index, e1Parent);
    },

    /**
     * Send a letter to main tables
     */
    handleLetterClick() {
      const thisTableId = $(this).closest('table').attr('id');
      const position = thisTableId === 'mainTable' ? 'last' : 'first';
      App.swap($(this), $(`div#main table:not(#${thisTableId}) td.empty:${position}`));
    },

    /**
     * Restarts the game
     */
    playAgain() {
      IO.socket.emit('restartGame', { gameId: App.gameId });
    },

    /* *******************************
       *         HOST CODE           *
       ******************************* */
    Host: {

      /**
       * Handler for the "Start" button on the Title Screen.
       */
      onCreateClick() {
        IO.socket.emit('getDefaultConfig');
      },

      /**
       * Show create game screen
       * @param config {{ wordLength: number, timeLimit: number }}
       */
      showCreateGameScreen(config) {
        App.Host.displayNewGameScreen();
        $('#wordLength').val(config.wordLength);
        $('#wordLengthValue').text(config.wordLength);
        $('#timeLimit').val(config.timeLimit);
        $('#timeLimitValue').text(config.timeLimit);
      },

      /**
       * Handler for the "Create Room" button
       */
      onCreateRoomClick() {
        const data = {
          name: $('#inputPlayerName').val(),
          wordLength: $('#wordLength').val(),
          timeLimit: $('#timeLimit').val(),
        };
        if (!data.name) {
          alert('Enter your name to proceed!');
        } else {
          IO.socket.emit('createNewGame', data);
        }
      },

      /**
       * Handler for the "Start Game" button
       */
      onStartClick() {
        App.myRole = 'Host';
        IO.socket.emit('startNewGame', { gameId: App.gameId });
      },

      /**
       * The Host screen is displayed for the first time.
       * @param data{{ gameId: int, mySocketId: string }}
       */
      gameInit(data) {
        App.gameId = data.gameId;
        App.mySocketId = data.mySocketId;
        App.myRole = 'Host';
        App.Host.numPlayersInRoom = 0;
      },

      /**
       * Show the Host screen containing the game URL and unique game ID
       */
      displayNewGameScreen() {
        // Fill the game screen with the appropriate HTML
        App.$gameArea.html(App.$templateNewGame);
        $('.createRoom').show();
        $('.wait').hide();
      },

      /**
       * Update the Host screen when the first player joins
       * @param data {{ playerName: string }}
       */
      updateWaitingScreen(data) {
        // Update host screen
        $('#playersWaiting')
          .append('<p/>')
          .text(`${data.playerName} joined the game.`);

        $('#btnStart').show();
      },

    },


    /* ***************************
       *        GUEST CODE       *
       *************************** */

    Guest: {

      /**
       * Click handler for the 'JOIN' button
       */
      onJoinClick() {
        // Display the Join Game HTML on the player's screen.
        App.$gameArea.html(App.$templateJoinGame);
      },

      /**
       * The player entered their name and gameId (hopefully)
       * and clicked Start.
       */
      onGuestReadyClick() {
        // collect data to send to the server
        const data = {
          gameId: +($('#inputGameId').val()),
          playerName: $('#inputPlayerName').val(),
        };

        if (!data.playerName) {
          alert('Enter your name to proceed!');
        } else {
          // Send the gameId and playerName to the server
          IO.socket.emit('joinGame', data);
        }

        // Set the appropriate properties for the current player.
        App.myRole = 'Guest';
      },

      /**
       * Display the waiting screen
       * @param data {{ gameId: int }}
       */
      updateWaitingScreen(data) {
        if (IO.socket.id === data.mySocketId) {
          App.gameId = data.gameId;
          $('#btnReady').hide();
          $('#guestWaitingMessage').show();
          $('#gameId').text(data.gameId);
        }
      },

    },


    /* ***********************
       *     UTILITY CODE    *
       *********************** */

    /**
     * Show the word for the current round on screen.
     * @param data {{ word: string, allWordsLength: array }}
     */
    newWord(data) {
      $('#wordArea').html(App.$templateGameBoard);
      App.generateBoard(data.word, data.allWordsLength);
    },

    /**
     * Show the countdown screen
     * @param data {{ mySocketId: string, gameId: int, scoreBoard: object, timeLimit: number }}
     */
    gameCountdown(data) {
      // Prepare the game screen with new HTML
      App.$gameArea.html(App.$hostGame);
      $('#result').hide();

      App.doTextFit('#hostWord');

      App.updateScoreBoard(data.scoreBoard);
      IO.timer({ countdown: data.timeLimit });

      // Begin the on-screen countdown timer
      const $secondsLeft = $('#hostWord');
      App.countDown($secondsLeft, 5, () => {
        if (App.myRole === 'Host') {
          console.log('countdownFinished');
          IO.socket.emit('countdownFinished', App.gameId);
        }
      });
    },

    /**
     * Display the countdown timer on the Host screen
     *
     * @param $el The container element for the countdown timer
     * @param startTime
     * @param callback The function to call when the timer ends.
     */
    countDown($el, startTime, callback) {
      // Display the starting time on the screen.
      $el.text(startTime);
      App.doTextFit('#hostWord');

      // Start a 1 second timer
      const timer = setInterval(countItDown, 1000);

      // Decrement the displayed timer value on each 'tick'
      function countItDown() {
        startTime -= 1;
        $el.text(startTime);
        App.doTextFit('#hostWord');

        if (startTime <= 0) {
          // console.log('Countdown Finished.');

          // Stop the timer and do the callback.
          clearInterval(timer);
          callback();
        }
      }
    },

    /**
     * Make the text inside the given element as big as possible
     * See: https://github.com/STRML/textFit
     *
     * @param el The parent element of some text
     */
    doTextFit(el) {
      textFit(
        $(el)[0],
        {
          alignHoriz: true,
          alignVert: false,
          widthOnly: true,
          reProcess: true,
          maxFontSize: 300,
        },
      );
    },
  };

  /**
   * All the code relevant to Socket.IO is collected in the IO namespace.
   */
  const IO = {

    /**
     * This is called when the page is displayed. It connects the Socket.IO client
     * to the Socket.IO server
     */
    init() {
      IO.socket = io.connect();
      IO.bindEvents();
    },

    /**
     * While connected, Socket.IO will listen to the following events emitted
     * by the Socket.IO server, then run the appropriate function.
     */
    bindEvents() {
      IO.socket.on('connected', IO.onConnected);
      IO.socket.on('defaultConfig', App.Host.showCreateGameScreen);
      IO.socket.on('newGameCreated', IO.onNewGameCreated);
      IO.socket.on('startNewGame', IO.startNewGame);
      IO.socket.on('guestJoinedRoom', IO.guestJoinedRoom);
      IO.socket.on('beginNewGame', IO.beginNewGame);
      IO.socket.on('errorMessage', IO.error);
      IO.socket.on('newWordData', IO.onNewWordData);
      IO.socket.on('wordChecked', IO.wordChecked);
      IO.socket.on('timer', IO.timer);
      IO.socket.on('endGame', IO.endGame);
      IO.socket.on('resetGame', IO.resetGame);
    },

    /**
     * The client is successfully connected!
     */
    onConnected() {
      // Cache a copy of the client's session ID on the App
      App.mySocketId = IO.socket.id;
    },

    /**
     * A new game has been created and a random game ID has been generated.
     * @param data {{ gameId: int, mySocketId: string }}
     * @param reset Denotes whether it's a new game or a reset
     */
    onNewGameCreated(data, reset) {
      App.Host.gameInit(data);
      $('.createRoom').hide();
      $('.wait').show();
      $('#spanNewGameCode').text(App.gameId);
      $('#btnStart').hide();
      if (reset === true) {
        $('#disconnectMsg').show();
      } else {
        $('#disconnectMsg').hide();
      }
    },

    /**
     * Start a new game.
     */
    startNewGame() {
      // FIXME: events are not getting registered
      App.init();
    },

    /**
     * A guest has successfully joined the game.
     * @param data {{ guestName: string, gameId: int, mySocketId: int }}
     */
    guestJoinedRoom(data) {
      // When a guest joins a room, do the updateWaitingScreen function.
      // There are two versions of this function: one for the 'host' and
      // another for the 'guest'.
      //
      // So on the 'host' browser window, the App.Host.updateWaitingScreen function is called.
      // And on the guest's browser, App.Guest.updateWaitingScreen is called.
      App[App.myRole].updateWaitingScreen(data);
    },

    /**
     * Both players have joined the game.
     * @param data {{ mySocketId: string, gameId: int, scoreBoard: object, timeLimit: number }}
     */
    beginNewGame(data) {
      App.gameCountdown(data);
    },

    /**
     * A new word for the round is returned from the server.
     * @param data {{ word: string, allWordsLength: array }}
     */
    onNewWordData(data) {
      // Show the game board for the Host and the Guest
      App.newWord(data);
    },

    /**
     * Server returns the result of entered word
     * @param data {{ socketId: string, incorrectWord: boolean,
     *    alreadyTaken: boolean, word: string, index: number }}
     */
    wordChecked(data) {
      if (data.incorrectWord === true) {
        // TODO: handle incorrect word (show red border/animation etc.)
      } else if (data.alreadyTaken === true) {
        // TODO: handle already taken word (highlight the word or something)
      } else {
        data.word = data.word.toUpperCase();
        App.updateScoreBoard(data.scoreBoard);

        let scorer = App.myRole;
        if (data.socketId !== App.mySocketId) {
          scorer = App.myRole === 'Guest' ? 'Host' : 'Guest';
        }

        const wordIndex = data.index;
        if (wordIndex !== -1) {
          $('#allWords table').eq(wordIndex).find('td').each(function iterator(i) {
            $(this).text(data.word[i]).addClass(scorer);
          });
        }
      }
      if (data.socketId === App.mySocketId) {
        App.recallLetters();
      }
    },

    /**
     * An error has occurred.
     * @param data {{ message: string }}
     */
    error(data) {
      if (data.message) {
        alert(data.message);
      }
    },

    /**
     * Update the timer
     */
    timer(data) {
      let time = data.countdown;
      time = `${Math.floor(time / 60)}:${time % 60}`;

      const timerPattern = /^\d+|\d+$/g;

      $('#time').text(time.replace(timerPattern, value => (`0${value}`).slice(-2)));
    },

    /**
     * End the game and show the result
     * @param data {{ winner: string, winnerId: string }}
     */
    endGame(data) {
      App.updateScoreBoard(data.scoreBoard);
      $('#result, #wordArea').toggle();
      if (data.winner === undefined) {
        $('#result #message').text("It's a tie!");
      } else if (IO.socket.id === data.winnerID) {
        $('#result #message').text('Congrats! You won the game!');
      } else {
        $('#result #message').text(`${data.winner} won the game!`);
      }
      App.doTextFit('#result #message');
    },

    /**
     * Reset the game
     * @param data {{ gameId: int, mySocketId: string }}
     */
    resetGame(data) {
      App.$gameArea.html(App.$templateNewGame);
      IO.onNewGameCreated(data, true);
    },

  };

  IO.init();
  App.init();
}($));
