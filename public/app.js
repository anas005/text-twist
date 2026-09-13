/* eslint-env jquery */
/* eslint-env browser */
/* global io:true */
/* global FastClick:true */
/* global textFit:true */
/* global SoundFX:true */
/* global FX:true */
/* global ThemeManager:true */
/* global Board:true */

/* eslint-disable no-param-reassign */
/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* eslint-disable no-console */
/* eslint-disable no-alert */

jQuery(
  (function fn($) {
    const App = {
      /**
       * The Socket.IO socket object identifier. This is unique for
       * each player and host.
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
        // Bind delegated handlers exactly once for the page lifetime;
        // re-binding would fire every handler multiple times per event
        // (e.g. one keypress moving two identical letters).
        if (!App.eventsBound) {
          App.eventsBound = true;
          App.bindEvents();
        }
        App.updateSoundIcon();
        ThemeManager.init();

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

        // Navigation
        App.$doc.on('click', '#btnBackToMenu', App.backToMenu);

        // Common
        App.$doc.on('input', 'input[type=range]', App.updateRangeText);
        App.$doc.on('click', '#shuffle', Board.shuffleLetters);
        App.$doc.on('click', '#check', App.checkWord);
        App.$doc.on('click', '#recall', Board.recallLetters);
        App.$doc.on('click', '#playAgain', App.playAgain);
        App.$doc.on(
          'click',
          '#mainTable td:not(.empty), #shuffledTable td:not(.empty)',
          Board.handleLetterClick,
        );
        App.$doc.on('click', '#soundToggle', App.toggleSound);
        App.$doc.on('click', '#themeBtn', App.cycleTheme);
        App.$doc.on('click', '#rulesBtn', () => {
          $('#rulesModal').toggleClass('open');
          App.closeMenu();
        });
        App.$doc.on('click', '#menuToggle', App.toggleMenu);
        App.$doc.on('click', (e) => {
          if (!$(e.target).closest('#menuWrap').length) App.closeMenu();
        });
        App.$doc.on('keydown', (e) => {
          if (e.key === 'Escape') App.closeMenu();
        });
        App.$doc.on('click', '#rulesClose', App.closeRules);
        App.$doc.on('click', '#rulesModal', (e) => {
          if ($(e.target).attr('id') === 'rulesModal') App.closeRules();
        });
        App.$doc.on('mouseenter', '#allWords .word-group', App.showDefTip);
        App.$doc.on('mouseleave', '#allWords .word-group', App.hideDefTip);
        App.$doc.on(
          'click touchstart',
          '#allWords .word-group',
          App.toggleDefTip,
        );
      },

      /* *************************************
       *         UI HELPERS                *
       ************************************* */

      /**
       * Show a definition tooltip for a solved word rack.
       * Found words always show definitions; after game over,
       * auto-revealed (missed) words do too.
       */
      showDefTip(e) {
        const $group = $(e.currentTarget);
        const isSolved = $group.find('.box.found, .box.bonus').length > 0;
        if (!isSolved && !App.gameOver) return;
        const index = $('#allWords .word-group').index($group);
        const word = App.boardAnswers[index];
        const def = word && App.wordDefinitions[word.toLowerCase()];
        if (!def) return;

        let $tip = $('#defTip');
        if ($tip.length === 0) {
          $tip = $('<div id="defTip"></div>').appendTo('body');
        }
        $tip.empty();
        const $head = $('<div class="def-head"></div>');
        $('<span class="def-word"></span>')
          .text(word.toUpperCase())
          .appendTo($head);
        if (def.partOfSpeech) {
          $('<span class="def-pos"></span>')
            .text(def.partOfSpeech)
            .appendTo($head);
        }
        $tip.append($head);
        if (def.definition) {
          $('<div class="def-text"></div>').text(def.definition).appendTo($tip);
        }
        $tip.css('visibility', 'visible').addClass('open');

        const groupPos = $group.offset();
        const tipWidth = $tip.outerWidth() || 240;
        let left = groupPos.left + $group.outerWidth() / 2 - tipWidth / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
        $tip.css({
          left: `${left}px`,
          top: `${groupPos.top - ($tip.outerHeight() || 60) - 10}px`,
        });
      },

      hideDefTip() {
        $('#defTip').removeClass('open');
      },

      /**
       * Tap support for touch devices.
       */
      toggleDefTip(e) {
        if (
          $('#defTip.open').length > 0
          && $(e.currentTarget).is(App.lastDefGroup)
        ) {
          App.hideDefTip();
          App.lastDefGroup = null;
          return;
        }
        App.showDefTip(e);
        App.lastDefGroup = $(e.currentTarget);
      },

      cycleTheme() {
        SoundFX.select();
        ThemeManager.cycle();
        App.closeMenu();
      },

      toggleMenu(e) {
        if (e) e.stopPropagation();
        const $pop = $('#menuPop');
        const open = !$pop.hasClass('open');
        $pop.toggleClass('open', open);
        $('#menuToggle').attr('aria-expanded', String(open));
      },

      closeMenu() {
        $('#menuPop').removeClass('open');
        $('#menuToggle').attr('aria-expanded', 'false');
      },

      closeRules() {
        SoundFX.select();
        $('#rulesModal').removeClass('open');
        $('#rulesClose').text('Got it!');
      },

      toggleSound() {
        SoundFX.muted = !SoundFX.muted;
        window.localStorage.setItem('tt-muted', String(SoundFX.muted));
        App.updateSoundIcon();
        if (!SoundFX.muted) SoundFX.select();
        App.closeMenu();
      },

      updateSoundIcon() {
        $('#soundToggle').toggleClass('muted', SoundFX.muted);
        $('#iconSoundOn').toggle(!SoundFX.muted);
        $('#iconSoundOff').toggle(SoundFX.muted);
      },

      backToMenu() {
        SoundFX.deselect();
        App.myRole = '';
        App.gameId = undefined;
        App.showInitScreen();
      },

      updateRangeText() {
        const slider = $(this);
        $(`#${slider.data('for')}`).text(slider.val());
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

      /**
       * Transient feedback toast anchored below the scorer's name.
       */
      showToast(text, type, role) {
        $('.toast').remove();
        const $anchor = role === 'Host' ? $('#player1Score') : $('#player2Score');
        const $toast = $('<div></div>').addClass('toast').addClass(type);
        $('<span class="toast-word"></span>').text(text).appendTo($toast);
        $toast.appendTo('body');

        const anchorPos = $anchor.offset();
        if (anchorPos) {
          const anchorWidth = $anchor.outerWidth() || 0;
          const toastWidth = $toast.outerWidth() || 0;
          let left = anchorPos.left + (anchorWidth - toastWidth) / 2;
          left = Math.max(
            8,
            Math.min(left, window.innerWidth - toastWidth - 8),
          );
          $toast.css({
            top: `${anchorPos.top + ($anchor.outerHeight() || 0) + 6}px`,
            left: `${left}px`,
          });
        }

        setTimeout(() => {
          $toast.addClass('out').one('animationend', () => $toast.remove());
        }, 2600);
      },

      /* *************************************
       *             GAME LOGIC            *
       ************************************* */

      showInitScreen() {
        App.$gameArea.html(App.$templateIntroScreen);
      },

      handleKeyPress(e) {
        if (!$('#gameArea #wordArea').is(':visible')) {
          return true;
        }

        if (e.keyCode === 13) {
          // ENTER KEY
          $('#check').click();
          return;
        }
        const $target = $(e.target || e.srcElement);
        if (
          e.keyCode === 8
          && !$target.is('input,[contenteditable="true"],textarea')
        ) {
          // BACKSPACE KEY
          e.preventDefault();
          $('#mainTable .letter:last').click();
          return;
        }
        if (e.keyCode === 32) {
          // SPACEBAR
          $('#shuffle').click();
        }
        const key = String.fromCharCode(e.keyCode);
        if (/^[a-z]$/i.test(key)) {
          // A-Z KEYS
          $('#shuffledTable .letter').each(function iterator() {
            if ($(this).text() === key) {
              $(this).click();
              return false;
            }
          });
        }
      },

      checkWord() {
        IO.socket.emit('checkWord', {
          word: $('#mainTable .letter').text(),
          gameId: App.gameId,
        });
      },

      playAgain() {
        $('#playAgain').prop('disabled', true);
        IO.socket.emit('restartGame', { gameId: App.gameId });
      },

      newWord(data) {
        SoundFX.join();
        App.hideDefTip();
        App.gameOver = false;
        $('#wordArea').html(App.$templateGameBoard);
        const info = Board.generateBoard(data.word, data.allWordsLength);
        App.boardMaxLen = info.maxLen;
        FX.animate($('#main'), 'pop-anim');
      },

      gameCountdown(data) {
        // Kill any previous countdown — a second beginNewGame
        // (both players hitting Play Again) must not double-fire.
        if (App.countdownTimer) {
          clearInterval(App.countdownTimer);
          App.countdownTimer = null;
        }
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

      countDown($el, startTime, callback) {
        $el.text(startTime);
        App.doTextFit('#hostWord');

        if (App.countdownTimer) {
          clearInterval(App.countdownTimer);
        }
        App.countdownTimer = setInterval(countItDown, 1000);

        function countItDown() {
          startTime -= 1;
          $el.text(startTime);
          App.doTextFit('#hostWord');

          if (startTime <= 0) {
            clearInterval(App.countdownTimer);
            App.countdownTimer = null;
            callback();
          }
        }
      },

      doTextFit(el) {
        textFit($(el)[0], {
          alignHoriz: true,
          alignVert: false,
          widthOnly: true,
          reProcess: true,
          maxFontSize: 300,
        });
      },

      /* *******************************
       *         HOST CODE           *
       ******************************* */
      Host: {
        onCreateClick() {
          IO.socket.emit('getDefaultConfig');
        },

        showCreateGameScreen(config) {
          App.Host.displayNewGameScreen();
          $('#wordLength').val(config.wordLength);
          $('#wordLengthValue').text(config.wordLength);
          $('#timeLimit').val(config.timeLimit);
          $('#timeLimitValue').text(config.timeLimit);
        },

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

        onStartClick() {
          App.myRole = 'Host';
          IO.socket.emit('startNewGame', { gameId: App.gameId });
        },

        gameInit(data) {
          App.gameId = data.gameId;
          App.mySocketId = data.mySocketId;
          App.myRole = 'Host';
          App.Host.numPlayersInRoom = 0;
        },

        displayNewGameScreen() {
          App.$gameArea.html(App.$templateNewGame);
          $('.createRoom').show();
          $('.wait').hide();
        },

        updateWaitingScreen(data) {
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
        onJoinClick() {
          App.$gameArea.html(App.$templateJoinGame);
        },

        onGuestReadyClick() {
          const data = {
            gameId: +$('#inputGameId').val(),
            playerName: $('#inputPlayerName').val(),
          };

          if (!data.playerName) {
            alert('Enter your name to proceed!');
          } else {
            IO.socket.emit('joinGame', data);
          }

          App.myRole = 'Guest';
        },

        updateWaitingScreen(data) {
          if (IO.socket.id === data.mySocketId) {
            App.gameId = data.gameId;
            $('#btnReady').hide();
            $('#guestWaitingMessage').show();
            $('#gameId').text(data.gameId);
          }
        },
      },
    };

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     */
    const IO = {
      init() {
        IO.socket = io.connect();
        IO.bindEvents();
      },

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

      onConnected() {
        App.mySocketId = IO.socket.id;
      },

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

      startNewGame() {
        // The room vanished (e.g. opponent restart race) — return to menu.
        App.showInitScreen();
      },

      guestJoinedRoom(data) {
        SoundFX.join();
        App[App.myRole].updateWaitingScreen(data);
      },

      beginNewGame(data) {
        App.gameCountdown(data);
      },

      onNewWordData(data) {
        // Keep answers + definitions for hover tooltips on found words
        App.boardAnswers = data.answers || [];
        App.wordDefinitions = data.definitions || {};
        App.newWord(data);
      },

      wordChecked(data) {
        // Resolve which side made the attempt, for toast anchoring.
        let scorer = App.myRole;
        if (data.socketId !== App.mySocketId) {
          scorer = App.myRole === 'Guest' ? 'Host' : 'Guest';
        }
        const isMine = data.socketId === App.mySocketId;

        if (data.incorrectWord === true) {
          SoundFX.wrong();
          FX.animate($('#mainTable'), 'warn-anim');
          $('#mainTable td.letter').each(function flash() {
            FX.animate($(this), 'flash-red');
          });
          App.showToast(`${String(data.word).toUpperCase()} ❌`, 'err', scorer);
        } else if (data.alreadyTaken === true) {
          SoundFX.already();
          FX.animate($('#mainTable'), 'warn-anim');
          App.showToast(`${String(data.word).toUpperCase()} 🔁`, 'dup', scorer);
        } else {
          data.word = data.word.toUpperCase();
          App.updateScoreBoard(data.scoreBoard);

          const wordIndex = data.index;
          if (wordIndex !== -1) {
            const isBonus = data.word.length === App.boardMaxLen;
            const boxClass = isBonus ? 'bonus' : 'found';
            const owner = scorer === 'Host' ? 'host' : 'guest';
            const $cells = $('#allWords .word-group')
              .eq(wordIndex)
              .find('.box');
            $cells.each(function iterator(i) {
              $(this)
                .text(data.word[i])
                .addClass(boxClass)
                .addClass(owner);
              setTimeout(() => FX.animate($(this), 'celebrate-anim'), i * 50);
            });
            Board.updateLenLabels();

            if (isMine) {
              App.showToast(
                isBonus
                  ? `Twist! ${data.word} +${data.word.length}`
                  : `${data.word} +${data.word.length}`,
                isBonus ? 'bonus' : 'ok',
                scorer,
              );
            } else {
              App.showToast(`${data.word} +${data.word.length}`, 'ok', scorer);
            }

            if (isMine) {
              SoundFX.correct();
              FX.celebrateBoard();
            } else {
              const $group = $('#allWords .word-group').eq(wordIndex);
              const groupPos = $group.offset();
              if (groupPos) {
                FX.confettiBurst(
                  groupPos.left + $group.outerWidth() / 2,
                  groupPos.top + $group.outerHeight() / 2,
                  14,
                );
              }
            }
          }

          $('.playerScore').each(function bump() {
            if ($(this).data('socketID') === data.socketId) {
              FX.animate($(this).find('.score'), 'score-bump');
            }
          });
        }
        if (data.socketId === App.mySocketId) {
          Board.recallLetters();
        }
      },

      error(data) {
        if (data.message) {
          alert(data.message);
        }
      },

      timer(data) {
        let time = data.countdown;
        time = `${Math.floor(time / 60)}:${time % 60}`;

        const timerPattern = /^\d+|\d+$/g;

        $('#time').text(
          time.replace(timerPattern, (value) => `0${value}`.slice(-2)),
        );

        if (data.countdown > 0 && data.countdown <= 15) {
          SoundFX.tick();
          $('#time').addClass('urgent');
        } else {
          $('#time').removeClass('urgent');
        }
      },

      endGame(data) {
        App.updateScoreBoard(data.scoreBoard);
        // Hide the board and put the winner message in its place;
        // the answer grid stays visible below with everything revealed.
        $('#main').hide();
        const $result = $('#result').detach();
        $('#wordArea').prepend($result);
        $result.show();
        if (data.winner === undefined) {
          $('#result #message').text("It's a tie!");
          SoundFX.already();
        } else if (IO.socket.id === data.winnerID) {
          $('#result #message').text('Congrats! You won the game!');
          SoundFX.win();
          FX.confettiBurst(window.innerWidth / 2, window.innerHeight / 3, 80);
          setTimeout(
            () => FX.confettiBurst(
              window.innerWidth / 4,
              window.innerHeight / 2,
              40,
            ),
            300,
          );
          setTimeout(
            () => FX.confettiBurst(
              (window.innerWidth * 3) / 4,
              window.innerHeight / 2,
              40,
            ),
            500,
          );
        } else {
          $('#result #message').text(`${data.winner} won the game!`);
          SoundFX.lose();
        }
        IO.renderAnswerReveal(data.answers || [], data.foundWords || {});
        App.gameOver = true;
        App.doTextFit('#result #message');
      },

      renderAnswerReveal(answers, foundWords) {
        answers.forEach((word, i) => {
          if (foundWords[word]) return;
          const $cells = $('#allWords .word-group').eq(i).find('.box');
          $cells.each(function iterator(j) {
            $(this)
              .text((word[j] || '').toUpperCase())
              .addClass('missed');
          });
        });
      },

      resetGame(data) {
        App.$gameArea.html(App.$templateNewGame);
        IO.onNewGameCreated(data, true);
      },
    };

    IO.init();
    App.init();
  }($)),
);
