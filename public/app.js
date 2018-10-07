;
jQuery(function ($) {
    'use strict';

    $.fn.insertAt = function (index, $parent) {
        return this.each(function () {
            if (index === 0) {
                $parent.prepend(this);
            } else {
                $parent.children().eq(index - 1).after(this);
            }
        });
    };

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     */
    var IO = {

        /**
         * This is called when the page is displayed. It connects the Socket.IO client
         * to the Socket.IO server
         */
        init: function () {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
         * While connected, Socket.IO will listen to the following events emitted
         * by the Socket.IO server, then run the appropriate function.
         */
        bindEvents: function () {
            IO.socket.on('connected', IO.onConnected);
            IO.socket.on('newGameCreated', IO.onNewGameCreated);
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);
            IO.socket.on('beginNewGame', IO.beginNewGame);
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('error', IO.error);
            IO.socket.on('wordChecked', IO.wordChecked);
            IO.socket.on('timer', IO.timer);
            IO.socket.on('endGame', IO.endGame);
            IO.socket.on('resetGame', IO.resetGame);
        },

        /**
         * The client is successfully connected!
         */
        onConnected: function (data) {
            // Cache a copy of the client's socket.IO session ID on the App
            App.mySocketId = IO.socket.socket.sessionid;
            // console.log(data.message);
            // $(".textFitted").text(data.word);
        },

        /**
         * A new game has been created and a random game ID has been generated.
         * @param data {{ gameId: int, mySocketId: * }}
         */
        onNewGameCreated: function (data, reset) {
            App.Host.gameInit(data);
            $(".createRoom").hide();
            $(".wait").show();
            $('#spanNewGameCode').text(App.gameId);
            $("#btnStart").hide();
            if (reset === true) {
                $("#disconnectMsg").show();
            } else {
                $("#disconnectMsg").hide();
            }
        },

        /**
         * A player has successfully joined the game.
         * @param data {{playerName: string, gameId: int, mySocketId: int}}
         */
        playerJoinedRoom: function (data) {
            // When a player joins a room, do the updateWaitingScreen function.
            // There are two versions of this function: one for the 'host' and
            // another for the 'player'.
            //
            // So on the 'host' browser window, the App.Host.updateWaitingScreen function is called.
            // And on the player's browser, App.Player.updateWaitingScreen is called.
            App[App.myRole].updateWaitingScreen(data);
        },

        /**
         * Both players have joined the game.
         * @param data
         */
        beginNewGame: function (data) {
            App.Host.gameCountdown(data);
        },

        /**
         * A new set of words for the round is returned from the server.
         * @param data
         */
        onNewWordData: function (data) {
            // Update the current round
            App.currentRound = data.round;

            // Change the word for the Host and Player
            App[App.myRole].newWord(data);
        },

        /**
         * A player answered. If this is the host, check the answer.
         * @param data
         */
        hostCheckAnswer: function (data) {
            if (App.myRole === 'Host') {
                App.Host.checkAnswer(data);
            }
        },

        wordChecked: function (data) {
            data.word = data.word.toUpperCase();
            App.updateScoreBoard(data.scoreBoard);
            let wordIndex = data.index;
            if (wordIndex !== -1) {
                $("#allWords table").eq(wordIndex).find("td").each(function (i) {
                    $(this).text(data.word[i]).addClass("correctLetter");
                });
            }
            App.recallLetters();
        },

        /**
         * Let everyone know the game has ended.
         * @param data
         */
        gameOver: function (data) {
            App[App.myRole].endGame(data);
        },

        /**
         * An error has occurred.
         * @param data
         */
        error: function (data) {
            if (data.message) {
                alert(data.message);
            }
        },

        timer: function (data) {
            let time = data.countdown;
            time = (Math.floor(time / 60)) + ":" + (time % 60)

            let timerPattern = /^\d+|\d+$/g;

            $("#time").text(time.replace(timerPattern, function padZero(value) {
                return ("0" + value).slice(-2);
            }));
        },

        endGame: function (data) {
            App.updateScoreBoard(data.scoreBoard);
            $("#result, #wordArea").toggle();
            // debugger;
            console.log('end game. data received:', JSON.stringify(data));
            if (data.winner === undefined) {
                $("#result #message").text("It's a tie!");
            } else if (IO.socket.socket.sessionid === data.winnerID) {
                $("#result #message").text("Congrats! You won the game!");
            } else {
                $("#result #message").text(data.winner + " won the game!");
            }
            App.doTextFit("#result #message");
        },

        resetGame: function (data) {
            App.$gameArea.html(App.$templateNewGame);
            IO.onNewGameCreated(data, true);
        }

    };

    var App = {

        /**
         * Keep track of the gameId, which is identical to the ID
         * of the Socket.IO Room used for the players and host to communicate
         *
         */
        gameId: 0,

        /**
         * This is used to differentiate between 'Host' and 'Player' browsers.
         */
        myRole: '',   // 'Player' or 'Host'

        /**
         * The Socket.IO socket object identifier. This is unique for
         * each player and host. It is generated when the browser initially
         * connects to the server when the page loads for the first time.
         */
        mySocketId: '',

        /**
         * Identifies the current round. Starts at 0 because it corresponds
         * to the array of word data stored on the server.
         */
        currentRound: 0,

        /* *************************************
         *                Setup                *
         * *********************************** */

        /**
         * This runs when the page initially loads.
         */
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();

            // Initialize the fastclick library
            FastClick.attach(document.body);
        },

        /**
         * Create references to on-screen elements used throughout the game.
         */
        cacheElements: function () {
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
        bindEvents: function () {

            App.$doc.on('keydown', App.handleKeyPress);

            // Host
            App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);
            App.$doc.on('click', '#btnCreateRoom', App.Host.onCreateRoomClick);
            App.$doc.on('click', '#btnStart', App.Host.onStartClick);

            // Player
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnReady', App.Player.onPlayerReadyClick);
            App.$doc.on('click', '.btnAnswer', App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart);

            // Common
            App.$doc.on('click', '#submitAnswer', App.checkAnswer);
            App.$doc.on('click', '#shuffle', App.shuffleLetters);
            App.$doc.on('click', '#check', App.checkWord);
            App.$doc.on('click', '#recall', App.recallLetters);
            App.$doc.on('click', '#playAgain', App.playAgain);


            App.$doc.on('click', '#mainTable td:not(.empty), #shuffledTable td:not(.empty)', App.handleLetterClick);

        },

        /* *************************************
         *             Game Logic              *
         * *********************************** */

        /**
         * Show the initial Anagrammatix Title Screen
         * (with Start and Join buttons)
         */
        showInitScreen: function () {
            App.$gameArea.html(App.$templateIntroScreen);
            App.doTextFit('.title');
        },

        handleKeyPress: function (e) {
            if (e.keyCode === 13) { // ENTER KEY
                e.preventDefault();
                $("#check").click();
                return;
            }
            if (e.keyCode === 8) { // BACKSPACE KEY
                e.preventDefault();
                $("#mainTable .letter:last").click();
                return;
            }
            if (e.keyCode === 32) { // SPACEBAR
                e.preventDefault();
                $("#shuffle").click();
            }
            let key = String.fromCharCode(e.keyCode);
            if ((/^[a-z]$/i).test(key)) { // A-Z KEYS
                $("#shuffledTable .letter").each(function () {
                    if ($(this).text() === key) {
                        $(this).click();
                        return false;
                    }
                });
            }
        },

        generateBoard: function (word, allWordsLength) {
            let mainRow = $("#mainTable tr").empty(),
                shuffledRow = $("#shuffledTable tr").empty();

            for (let i = 0; i < word.length; i++) {
                mainRow.append($("<td></td>").addClass("empty"));
                shuffledRow.append($("<td></td>").addClass("letter").text(word[i]));
            }

            $("#allWords").empty();
            allWordsLength.forEach(function (length) {
                let table = $("<table></table>");
                let row = $("<tr></tr>").append("<td></td>".repeat(length));
                table.append(row);
                $("#allWords").append(table);
            });
        },

        updateScoreBoard: function (scoreBoard) {
            let socketIds = Object.keys(scoreBoard);
            $(".playerScore").each(function (index) {
                $(this).data("socketID", socketIds[index]);
                $(this).find(".score").text(scoreBoard[socketIds[index]].score)
                $(this).find(".playerName").text(scoreBoard[socketIds[index]].name)
            });
        },

        shuffle: function (array) {
            var currentIndex = array.length
                , temporaryValue
                , randomIndex
                ;

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
        },

        shuffleLetters: function () {
            let letters = $("#shuffledTable td").toArray();
            App.shuffle(letters);
            for (let i = 0; i < letters.length; i++) {
                $("#shuffledTable tr").append(letters[i]);
            }
        },

        checkWord: function () {
            console.log("Check word...");
            IO.socket.emit('checkWord', { word: $("#mainTable .letter").text(), gameId: App.gameId });
        },

        recallLetters: function () {
            $("#mainTable .letter").each(function () {
                App.swap($(this), $("#shuffledTable .empty:eq(0)"));
            });
        },

        swap: function (e1, e2) {
            let e1Index = e1.index();
            let e2Index = e2.index();
            let e1Parent = e1.parent();
            let e2Parent = e2.parent();
            e1.insertAt(e2Index, e2Parent);
            e2.insertAt(e1Index, e1Parent);
        },

        handleLetterClick: function () {
            let thisTableId = $(this).closest("table").attr("id");
            let position = thisTableId === "mainTable" ? "last" : "first";
            let thisParent = $(this).parent();
            App.swap($(this), $("div#main table:not(#" + thisTableId + ") td.empty:" + position));
        },

        playAgain: function () {
            IO.socket.emit('restartGame', { gameId: App.gameId });
        },

        /* *******************************
           *         HOST CODE           *
           ******************************* */
        Host: {

            /**
             * Contains references to player data
             */
            players: [],

            /**
             * Flag to indicate if a new game is starting.
             * This is used after the first game ends, and players initiate a new game
             * without refreshing the browser windows.
             */
            isNewGame: false,

            /**
             * Keep track of the number of players that have joined the game.
             */
            numPlayersInRoom: 0,

            /**
             * A reference to the correct answer for the current round.
             */
            currentCorrectAnswer: '',

            /**
             * Handler for the "Start" button on the Title Screen.
             */
            onCreateClick: function () {
                App.Host.displayNewGameScreen();
            },

            onCreateRoomClick: function () {
                var data = {
                    name: $("#inputPlayerName").val(),
                };
                if (!data.name) {
                    alert("Enter your name to proceed!")
                } else {
                    IO.socket.emit('hostCreateNewGame', data);
                }
            },

            /**
             * Handler for the "Start Game" button
             */
            onStartClick: function () {
                IO.socket.emit('hostStartNewGame', { gameId: App.gameId });
            },

            /**
             * The Host screen is displayed for the first time.
             * @param data{{ gameId: int, mySocketId: * }}
             */
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;
            },

            /**
             * Show the Host screen containing the game URL and unique game ID
             */
            displayNewGameScreen: function () {
                // Fill the game screen with the appropriate HTML
                App.$gameArea.html(App.$templateNewGame);
                $(".createRoom").show();
                $(".wait").hide();
            },

            /**
             * Update the Host screen when the first player joins
             * @param data{{playerName: string}}
             */
            updateWaitingScreen: function (data) {
                // If this is a restarted game, show the screen.
                if (App.Host.isNewGame) {
                    App.Host.displayNewGameScreen();
                }
                // Update host screen
                $('#playersWaiting')
                    .append('<p/>')
                    .text(data.playerName + ' joined the game.');

                $("#btnStart").show();

                // Store the new player's data on the Host.
                App.Host.players.push(data);

            },

            /**
             * Show the countdown screen
             */
            gameCountdown: function (data) {

                // Prepare the game screen with new HTML
                App.$gameArea.html(App.$hostGame);
                $("#result").hide();

                App.doTextFit('#hostWord');

                App.updateScoreBoard(data.scoreBoard);
                IO.timer({ countdown: data.timeLimit });

                // Begin the on-screen countdown timer
                var $secondsLeft = $('#hostWord');
                // IO.timer({ countdown: 120 });
                App.countDown($secondsLeft, 5, function () {
                    if (App.myRole === 'Host') {
                        IO.socket.emit('hostCountdownFinished', App.gameId);
                    }
                });

                // debugger
                // // Display the players' names on screen
                // $('#player1Score')
                //     .find('.playerName')
                //     .html(App.Host.players[0].playerName);

                // $('#player2Score')
                //     .find('.playerName')
                //     .html(App.Host.players[1].playerName);

                // Set the Score section on screen to 0 for each player.
                // $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
                // $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);
            },

            /**
             * Show the word for the current round on screen.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord: function (data) {
                // Insert the new word into the DOM
                // $('#hostWord').text(data.word);
                // debugger;
                $('#wordArea').html(App.$templateGameBoard);
                App.generateBoard(data.word, data.allWordsLength);

                // Update the data for the current round
                App.Host.currentCorrectAnswer = data.answer;
                App.Host.currentRound = data.round;
            },

            /**
             * All 10 rounds have played out. End the game.
             * @param data
             */
            endGame: function (data) {
                // Get the data for player 1 from the host screen
                var $p1 = $('#player1Score');
                var p1Score = +$p1.find('.score').text();
                var p1Name = $p1.find('.playerName').text();

                // Get the data for player 2 from the host screen
                var $p2 = $('#player2Score');
                var p2Score = +$p2.find('.score').text();
                var p2Name = $p2.find('.playerName').text();

                // Find the winner based on the scores
                var winner = (p1Score < p2Score) ? p2Name : p1Name;
                var tie = (p1Score === p2Score);

                // Display the winner (or tie game message)
                if (tie) {
                    $('#hostWord').text("It's a Tie!");
                } else {
                    $('#hostWord').text(winner + ' Wins!!');
                }
                App.doTextFit('#hostWord');

                // Reset game data
                App.Host.numPlayersInRoom = 0;
                App.Host.isNewGame = true;
            },

            /**
             * A player hit the 'Start Again' button after the end of a game.
             */
            restartGame: function () {
                App.$gameArea.html(App.$templateNewGame);
                $('#spanNewGameCode').text(App.gameId);
            }
        },


        /* *****************************
           *        PLAYER CODE        *
           ***************************** */

        Player: {

            /**
             * A reference to the socket ID of the Host
             */
            hostSocketId: '',

            /**
             * The player's name entered on the 'Join' screen.
             */
            myName: '',

            /**
             * Click handler for the 'JOIN' button
             */
            onJoinClick: function () {
                // console.log('Clicked "Join A Game"');

                // Display the Join Game HTML on the player's screen.
                App.$gameArea.html(App.$templateJoinGame);
            },

            /**
             * The player entered their name and gameId (hopefully)
             * and clicked Start.
             */
            onPlayerReadyClick: function () {

                // collect data to send to the server
                var data = {
                    gameId: +($('#inputGameId').val()),
                    playerName: $('#inputPlayerName').val()
                };

                if (!data.playerName) {
                    alert("Enter your name to proceed!")
                } else {
                    // Send the gameId and playerName to the server
                    IO.socket.emit('playerJoinGame', data);
                }

                // Set the appropriate properties for the current player.
                App.myRole = 'Player';
                App.Player.myName = data.playerName;
            },

            /**
             *  Click handler for the Player hitting a word in the word list.
             */
            onPlayerAnswerClick: function () {
                // console.log('Clicked Answer Button');
                var $btn = $(this);      // the tapped button
                var answer = $btn.val(); // The tapped word

                // Send the player info and tapped word to the server so
                // the host can check the answer.
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    answer: answer,
                    round: App.currentRound
                }
                IO.socket.emit('playerAnswer', data);
            },

            /**
             *  Click handler for the "Start Again" button that appears
             *  when a game is over.
             */
            onPlayerRestart: function () {
                var data = {
                    gameId: App.gameId,
                    playerName: App.Player.myName
                }
                IO.socket.emit('playerRestart', data);
                App.currentRound = 0;
                $('#gameArea').html("<h3>Waiting on host to start new game.</h3>");
            },

            /**
             * Display the waiting screen for player 1
             * @param data
             */
            updateWaitingScreen: function (data) {
                if (IO.socket.socket.sessionid === data.mySocketId) {
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    // debugger;
                    App.Host.players.push(data);

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
                }
            },

            /**
             * Display 'Get Ready' while the countdown timer ticks down.
             * @param hostData
             */
            gameCountdown: function (hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea')
                    .html('<div class="gameOver">Get Ready!</div>');
            },

            /**
             * Show the list of words for the current round.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord: function (data) {
                App.Host.newWord(data);
            },

            /*
            newWord : function(data) {
                // // Create an unordered list element
                // var $list = $('<ul/>').attr('id','ulAnswers');

                // // Insert a list item for each word in the word list
                // // received from the server.
                // $.each(data.list, function(){
                //     $list                                //  <ul> </ul>
                //         .append( $('<li/>')              //  <ul> <li> </li> </ul>
                //             .append( $('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                //                 .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                //                 .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                //                 .val(this)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                //                 .html(this)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                //             )
                //         )
                // });

                // // Insert the list onto the screen.
                $('#gameArea').html(App.$hostGame);
                $('#hostWord').text(data.word);
                App.doTextFit('#hostWord');
            }, */

            /**
             * Show the "Game Over" screen.
             */
            endGame: function () {
                $('#gameArea')
                    .html('<div class="gameOver">Game Over!</div>')
                    .append(
                    // Create a button to start a new game.
                    $('<button>Start Again</button>')
                        .attr('id', 'btnPlayerRestart')
                        .addClass('btn')
                        .addClass('btnGameOver')
                    );
            }
        },


        /* **************************
                  UTILITY CODE
           ************************** */

        /**
         * Display the countdown timer on the Host screen
         *
         * @param $el The container element for the countdown timer
         * @param startTime
         * @param callback The function to call when the timer ends.
         */
        countDown: function ($el, startTime, callback) {

            // Display the starting time on the screen.
            $el.text(startTime);
            App.doTextFit('#hostWord');

            // console.log('Starting Countdown...');

            // Start a 1 second timer
            var timer = setInterval(countItDown, 1000);

            // Decrement the displayed timer value on each 'tick'
            function countItDown() {
                startTime -= 1
                $el.text(startTime);
                App.doTextFit('#hostWord');

                if (startTime <= 0) {
                    // console.log('Countdown Finished.');

                    // Stop the timer and do the callback.
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        },

        /**
         * Make the text inside the given element as big as possible
         * See: https://github.com/STRML/textFit
         *
         * @param el The parent element of some text
         */
        doTextFit: function (el) {
            textFit(
                $(el)[0],
                {
                    alignHoriz: true,
                    alignVert: false,
                    widthOnly: true,
                    reProcess: true,
                    maxFontSize: 300
                }
            );
        },

        /**
         * Check the answer clicked by a player.
         * @param data{{round: *, playerId: *, answer: *, gameId: *}}
         */
        checkAnswer: function (data) {
            // Verify that the answer clicked is from the current round.
            // This prevents a 'late entry' from a player whose screen has not
            // yet updated to the current round.
            if (data.round === App.currentRound) {

                // Get the player's score
                var $pScore = $('#' + data.playerId);

                // Advance player's score if it is correct
                if (~data.answer.indeOf(App.Host.currentCorrectAnswer)) {
                    // Add 5 to the player's score
                    $pScore.text(+$pScore.text() + 5);

                    // Advance the round
                    App.currentRound += 1;

                    // Prepare data to send to the server
                    var data = {
                        gameId: App.gameId,
                        round: App.currentRound
                    }

                    // Notify the server to start the next round.
                    IO.socket.emit('hostNextRound', data);

                } else {
                    // A wrong answer was submitted, so decrement the player's score.
                    $pScore.text(+$pScore.text() - 3);
                }
            }
        }
    };

    IO.init();
    App.init();

}($));
