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

jQuery(
  (function fn($) {
    $.fn.insertAt = function insertAt(index, $parent) {
      return this.each(function onEach() {
        if (index === 0) {
          $parent.prepend(this);
        } else {
          $parent
            .children()
            .eq(index - 1)
            .after(this);
        }
      });
    };

    /**
     * Synthesized sound effects via Web Audio API (no audio files needed).
     */
    const SoundFX = {
      ctx: null,
      muted: window.localStorage.getItem("tt-muted") === "true",

      ensure() {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          this.ctx = new Ctx();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
      },

      tone(freq, duration, type, volume, delay) {
        if (this.muted) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const start = ctx.currentTime + (delay || 0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume || 0.15, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.05);
      },

      sweep(fromFreq, toFreq, duration, type, volume) {
        if (this.muted) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const start = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || "sawtooth";
        osc.frequency.setValueAtTime(fromFreq, start);
        osc.frequency.exponentialRampToValueAtTime(toFreq, start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume || 0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.05);
      },

      select() {
        this.tone(520, 0.09, "triangle", 0.18);
        this.tone(780, 0.07, "sine", 0.1, 0.03);
      },

      deselect() {
        this.tone(420, 0.08, "triangle", 0.12);
      },

      correct() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          this.tone(f, 0.16, "sine", 0.16, i * 0.07);
        });
      },

      wrong() {
        this.sweep(220, 110, 0.3, "sawtooth", 0.12);
        this.tone(160, 0.22, "square", 0.06, 0.05);
      },

      already() {
        this.tone(440, 0.1, "square", 0.08);
        this.tone(440, 0.12, "square", 0.08, 0.14);
      },

      shuffle() {
        this.sweep(300, 900, 0.18, "triangle", 0.1);
      },

      join() {
        this.tone(659.25, 0.12, "sine", 0.14);
        this.tone(987.77, 0.18, "sine", 0.14, 0.1);
      },

      tick() {
        this.tone(1200, 0.05, "square", 0.05);
      },

      win() {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          this.tone(f, 0.28, "triangle", 0.16, i * 0.11);
        });
      },

      lose() {
        [392, 349.23, 293.66, 261.63].forEach((f, i) => {
          this.tone(f, 0.3, "triangle", 0.13, i * 0.16);
        });
      },
    };

    /**
     * Visual effects helpers.
     */
    const FX = {
      animate($el, cls) {
        $el.addClass(cls).one("animationend", function onEnd() {
          $(this).removeClass(cls);
        });
      },

      /**
       * Confetti burst using the active theme's palette.
       */
      confettiBurst(x, y, count) {
        const style = getComputedStyle(document.documentElement);
        const colors = [
          "--primary",
          "--success",
          "--accent",
          "--danger",
          "--bonus",
        ]
          .map((v) => style.getPropertyValue(v).trim())
          .filter(Boolean);
        for (let i = 0; i < count; i += 1) {
          const piece = document.createElement("div");
          piece.className = "confetti-piece";
          const size = 6 + Math.random() * 8;
          piece.style.width = `${size}px`;
          piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`;
          piece.style.left = `${x}px`;
          piece.style.top = `${y}px`;
          piece.style.background =
            colors[Math.floor(Math.random() * colors.length)];
          piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 320}px`);
          piece.style.setProperty("--dy", `${-80 - Math.random() * 240}px`);
          piece.style.setProperty("--rot", `${(Math.random() - 0.5) * 720}deg`);
          document.body.appendChild(piece);
          setTimeout(piece.remove.bind(piece), 1300);
        }
      },

      celebrateBoard() {
        const offset = $("#wordArea").offset();
        const x = offset
          ? offset.left + $("#wordArea").width() / 2
          : window.innerWidth / 2;
        const y = offset ? offset.top + 60 : window.innerHeight / 3;
        FX.confettiBurst(x, y, 36);
        setTimeout(
          () =>
            FX.confettiBurst(window.innerWidth / 2, window.innerHeight / 2, 24),
          220,
        );
      },
    };

    /**
     * Applies themes defined in js/themes.js (pure data).
     * The game code never references concrete colors — switching a
     * theme is pure CSS variable substitution on :root.
     */
    const ThemeManager = {
      current: null,

      init() {
        if (!window.TextTwistThemes) return;
        this.apply(
          window.localStorage.getItem("tt-theme") ||
            Object.keys(window.TextTwistThemes)[0],
        );
      },

      apply(id) {
        const theme = window.TextTwistThemes && window.TextTwistThemes[id];
        if (!theme) return;
        this.current = id;
        window.localStorage.setItem("tt-theme", id);
        Object.keys(theme.vars).forEach((prop) => {
          document.documentElement.style.setProperty(prop, theme.vars[prop]);
        });
        // Expose the active theme for theme-specific structural CSS
        document.body.classList.remove(
          ...Array.from(document.body.classList).filter((c) =>
            c.startsWith("theme-"),
          ),
        );
        document.body.classList.add(`theme-${id}`);
      },

      cycle() {
        const ids = Object.keys(window.TextTwistThemes);
        const next = ids[(ids.indexOf(this.current) + 1) % ids.length];
        this.apply(next);
        return window.TextTwistThemes[next].label;
      },
    };

    const App = {
      /**
       * The Socket.IO socket object identifier. This is unique for
       * each player and host. It is generated when the browser initially
       * connects to the server when the page loads for the first time.
       */
      mySocketId: "",
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
        App.$gameArea = $("#gameArea");
        App.$templateIntroScreen = $("#intro-screen-template").html();
        App.$templateNewGame = $("#create-game-template").html();
        App.$templateJoinGame = $("#join-game-template").html();
        App.$templateGameBoard = $("#game-board-template").html();
        App.$hostGame = $("#host-game-template").html();
      },

      /**
       * Create some click handlers for the various buttons that appear on-screen.
       */
      bindEvents() {
        App.$doc.on("keydown", App.handleKeyPress);

        // Host
        App.$doc.on("click", "#btnCreateGame", App.Host.onCreateClick);
        App.$doc.on("click", "#btnCreateRoom", App.Host.onCreateRoomClick);
        App.$doc.on("click", "#btnStart", App.Host.onStartClick);

        // Guest
        App.$doc.on("click", "#btnJoinGame", App.Guest.onJoinClick);
        App.$doc.on("click", "#btnReady", App.Guest.onGuestReadyClick);

        // Navigation
        App.$doc.on("click", "#btnBackToMenu", App.backToMenu);

        // Common
        App.$doc.on("input", "input[type=range]", App.updateRangeText);
        App.$doc.on("click", "#shuffle", App.shuffleLetters);
        App.$doc.on("click", "#check", App.checkWord);
        App.$doc.on("click", "#recall", App.recallLetters);
        App.$doc.on("click", "#playAgain", App.playAgain);
        App.$doc.on(
          "click",
          "#mainTable td:not(.empty), #shuffledTable td:not(.empty)",
          App.handleLetterClick,
        );
        App.$doc.on("click", "#soundToggle", App.toggleSound);
        App.$doc.on("click", "#themeBtn", App.cycleTheme);
        App.$doc.on("click", "#rulesBtn", () =>
          $("#rulesModal").toggleClass("open"),
        );
        App.$doc.on("click", "#rulesClose", App.closeRules);
        App.$doc.on("click", "#rulesModal", (e) => {
          if ($(e.target).attr("id") === "rulesModal") App.closeRules();
        });
        App.$doc.on("mouseenter", "#allWords .word-group", App.showDefTip);
        App.$doc.on("mouseleave", "#allWords .word-group", App.hideDefTip);
        App.$doc.on(
          "click touchstart",
          "#allWords .word-group",
          App.toggleDefTip,
        );
      },

      /**
       * Show a definition tooltip for a solved word rack.
       * Only words that have been found reveal their definition.
       */
      showDefTip(e) {
        const $group = $(e.currentTarget);
        // Found words always show definitions; after game over,
        // auto-revealed (missed) words do too.
        const isSolved = $group.find(".box.found, .box.bonus").length > 0;
        if (!isSolved && !App.gameOver) return;
        const index = $("#allWords .word-group").index($group);
        const word = App.boardAnswers[index];
        const def = word && App.wordDefinitions[word.toLowerCase()];
        if (!def) return;

        let $tip = $("#defTip");
        if ($tip.length === 0) {
          $tip = $('<div id="defTip"></div>').appendTo("body");
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
        $tip.css("visibility", "visible").addClass("open");

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
        $("#defTip").removeClass("open");
      },

      /**
       * Tap support for touch devices.
       */
      toggleDefTip(e) {
        if (
          $("#defTip.open").length > 0 &&
          $(e.currentTarget).is(App.lastDefGroup)
        ) {
          App.hideDefTip();
          App.lastDefGroup = null;
          return;
        }
        App.showDefTip(e);
        App.lastDefGroup = $(e.currentTarget);
      },

      /**
       * Switch to the next available theme.
       */
      cycleTheme() {
        SoundFX.select();
        ThemeManager.cycle();
      },

      /**
       * Close the rules modal.
       */
      closeRules() {
        SoundFX.select();
        $("#rulesModal").removeClass("open");
        $("#rulesClose").text("Got it!");
      },

      /**
       * Toggle global sound on/off (persisted in localStorage).
       */
      toggleSound() {
        SoundFX.muted = !SoundFX.muted;
        window.localStorage.setItem("tt-muted", String(SoundFX.muted));
        App.updateSoundIcon();
        if (!SoundFX.muted) SoundFX.select();
      },

      /**
       * Return to the intro screen from Create/Join screens.
       */
      backToMenu() {
        SoundFX.deselect();
        App.myRole = "";
        App.gameId = undefined;
        App.showInitScreen();
      },

      updateSoundIcon() {
        $("#soundToggle").toggleClass("muted", SoundFX.muted);
        $("#iconSoundOn").toggle(!SoundFX.muted);
        $("#iconSoundOff").toggle(SoundFX.muted);
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
      },

      /**
       * Generate Game Board with given word.
       * The answer grid is grouped by word length with mono labels,
       * one mini rack of boxes per possible word.
       */
      generateBoard(word, allWordsLength) {
        const mainRow = $("#mainTable tr").empty();
        const shuffledRow = $("#shuffledTable tr").empty();

        for (let i = 0; i < word.length; i += 1) {
          mainRow.append($("<td></td>").addClass("empty"));
          const $tile = $("<td></td>").addClass("letter");
          $('<span class="tl"></span>').text(word[i]).appendTo($tile);
          shuffledRow.append($tile);
        }

        App.boardWord = word;
        App.boardMaxLen = word.length;

        // Build grouped answer grid (racks stay in server order,
        // so index i still corresponds to allWordsLength[i]).
        const $wrap = $("#allWords").empty();
        let lastLen = 0;
        let $row = null;
        allWordsLength.forEach((len) => {
          if (len !== lastLen) {
            lastLen = len;
            $row = $('<div class="len-row"></div>');
            $row.append($('<div class="len-label"></div>'));
            $wrap.append($row);
          }
          const $group = $('<span class="word-group"></span>');
          for (let i = 0; i < len; i += 1) {
            $group.append('<span class="box"></span>');
          }
          $row.append($group);
        });
        App.updateLenLabels();
      },

      /**
       * Update "N LETTERS · X/Y" counters on each group row.
       */
      updateLenLabels() {
        $("#allWords .len-row").each(function label() {
          const $groups = $(this).find(".word-group");
          const len = $groups.first().find(".box").length;
          const solved = $groups.filter(function isSolved() {
            return $(this).find(".box.found, .box.bonus").length > 0;
          }).length;
          $(this)
            .find(".len-label")
            .text(`${len} LETTERS · ${solved}/${$groups.length}`);
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
        if (!$("#gameArea #wordArea").is(":visible")) {
          return true;
        }

        if (e.keyCode === 13) {
          // ENTER KEY
          $("#check").click();
          return;
        }
        const $target = $(e.target || e.srcElement);
        if (
          e.keyCode === 8 &&
          !$target.is('input,[contenteditable="true"],textarea')
        ) {
          // BACKSPACE KEY
          e.preventDefault();
          $("#mainTable .letter:last").click();
          return;
        }
        if (e.keyCode === 32) {
          // SPACEBAR
          $("#shuffle").click();
        }
        const key = String.fromCharCode(e.keyCode);
        if (/^[a-z]$/i.test(key)) {
          // A-Z KEYS
          $("#shuffledTable .letter").each(function iterator() {
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
        $(".playerScore").each(function iterator(index) {
          $(this).data("socketID", socketIds[index]);
          $(this).find(".score").text(scoreBoard[socketIds[index]].score);
          $(this).find(".playerName").text(scoreBoard[socketIds[index]].name);
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
        $(`#${slider.data("for")}`).text(slider.val());
      },

      showToast(text, type, role) {
        $(".toast").remove();
        const $anchor =
          role === "Host" ? $("#player1Score") : $("#player2Score");
        const $toast = $("<div></div>").addClass("toast").addClass(type);
        $('<span class="toast-word"></span>').text(text).appendTo($toast);
        $toast.appendTo("body");

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
          $toast.addClass("out").one("animationend", () => $toast.remove());
        }, 2600);
      },

      /**
       * Shuffle letters present in hot board
       */
      shuffleLetters() {
        SoundFX.shuffle();
        const letters = $("#shuffledTable td").toArray();
        App.shuffle(letters);
        for (let i = 0; i < letters.length; i += 1) {
          $("#shuffledTable tr").append(letters[i]);
        }
        // Wrist-twist flip in place — the arc transform lives on the
        // tile, the flip animates the inner letter so it stays put.
        $("#shuffledTable td .tl").each(function stagger(i) {
          const $span = $(this);
          setTimeout(() => {
            $span.addClass("flip-anim").one("animationend", function onEnd() {
              $(this).removeClass("flip-anim");
            });
          }, i * 40);
        });
      },

      /**
       * send the entered word to server
       */
      checkWord() {
        IO.socket.emit("checkWord", {
          word: $("#mainTable .letter").text(),
          gameId: App.gameId,
        });
      },

      /**
       * Recall all the entered letters
       */
      recallLetters() {
        SoundFX.sweep(700, 250, 0.2, "triangle", 0.1);
        $("#mainTable .letter").each(function iterator() {
          App.swap($(this), $("#shuffledTable .empty:eq(0)"));
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
        // Guard against duplicated tap/click events on touch devices,
        // otherwise the letter swaps twice and appears to never move.
        const now = Date.now();
        const $tile = $(this);
        const lastClick = $tile.data("lastClick") || 0;
        if (now - lastClick < 300) return;
        $tile.data("lastClick", now);

        const thisTableId = $tile.closest("table").attr("id");
        const position = thisTableId === "mainTable" ? "last" : "first";
        const $destination = $(
          `div#main table:not(#${thisTableId}) td.empty:${position}`,
        );
        App.swap($tile, $destination);
        if (thisTableId === "shuffledTable") {
          SoundFX.select();
        } else {
          SoundFX.deselect();
        }
        FX.animate($destination, "pop-anim");
      },

      /**
       * Restarts the game
       */
      playAgain() {
        IO.socket.emit("restartGame", { gameId: App.gameId });
      },

      /* *******************************
       *         HOST CODE           *
       ******************************* */
      Host: {
        /**
         * Handler for the "Start" button on the Title Screen.
         */
        onCreateClick() {
          IO.socket.emit("getDefaultConfig");
        },

        /**
         * Show create game screen
         * @param config {{ wordLength: number, timeLimit: number }}
         */
        showCreateGameScreen(config) {
          App.Host.displayNewGameScreen();
          $("#wordLength").val(config.wordLength);
          $("#wordLengthValue").text(config.wordLength);
          $("#timeLimit").val(config.timeLimit);
          $("#timeLimitValue").text(config.timeLimit);
        },

        /**
         * Handler for the "Create Room" button
         */
        onCreateRoomClick() {
          const data = {
            name: $("#inputPlayerName").val(),
            wordLength: $("#wordLength").val(),
            timeLimit: $("#timeLimit").val(),
          };
          if (!data.name) {
            alert("Enter your name to proceed!");
          } else {
            IO.socket.emit("createNewGame", data);
          }
        },

        /**
         * Handler for the "Start Game" button
         */
        onStartClick() {
          App.myRole = "Host";
          IO.socket.emit("startNewGame", { gameId: App.gameId });
        },

        /**
         * The Host screen is displayed for the first time.
         * @param data{{ gameId: int, mySocketId: string }}
         */
        gameInit(data) {
          App.gameId = data.gameId;
          App.mySocketId = data.mySocketId;
          App.myRole = "Host";
          App.Host.numPlayersInRoom = 0;
        },

        /**
         * Show the Host screen containing the game URL and unique game ID
         */
        displayNewGameScreen() {
          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templateNewGame);
          $(".createRoom").show();
          $(".wait").hide();
        },

        /**
         * Update the Host screen when the first player joins
         * @param data {{ playerName: string }}
         */
        updateWaitingScreen(data) {
          // Update host screen
          $("#playersWaiting")
            .append("<p/>")
            .text(`${data.playerName} joined the game.`);

          $("#btnStart").show();
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
            gameId: +$("#inputGameId").val(),
            playerName: $("#inputPlayerName").val(),
          };

          if (!data.playerName) {
            alert("Enter your name to proceed!");
          } else {
            // Send the gameId and playerName to the server
            IO.socket.emit("joinGame", data);
          }

          // Set the appropriate properties for the current player.
          App.myRole = "Guest";
        },

        /**
         * Display the waiting screen
         * @param data {{ gameId: int }}
         */
        updateWaitingScreen(data) {
          if (IO.socket.id === data.mySocketId) {
            App.gameId = data.gameId;
            $("#btnReady").hide();
            $("#guestWaitingMessage").show();
            $("#gameId").text(data.gameId);
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
        SoundFX.join();
        App.hideDefTip();
        App.gameOver = false;
        $("#wordArea").html(App.$templateGameBoard);
        App.generateBoard(data.word, data.allWordsLength);
        FX.animate($("#main"), "pop-anim");
      },

      /**
       * Show the countdown screen
       * @param data {{ mySocketId: string, gameId: int, scoreBoard: object, timeLimit: number }}
       */
      gameCountdown(data) {
        // Prepare the game screen with new HTML
        App.$gameArea.html(App.$hostGame);
        $("#result").hide();

        App.doTextFit("#hostWord");

        App.updateScoreBoard(data.scoreBoard);
        IO.timer({ countdown: data.timeLimit });

        // Begin the on-screen countdown timer
        const $secondsLeft = $("#hostWord");
        App.countDown($secondsLeft, 5, () => {
          if (App.myRole === "Host") {
            console.log("countdownFinished");
            IO.socket.emit("countdownFinished", App.gameId);
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
        App.doTextFit("#hostWord");

        // Start a 1 second timer
        const timer = setInterval(countItDown, 1000);

        // Decrement the displayed timer value on each 'tick'
        function countItDown() {
          startTime -= 1;
          $el.text(startTime);
          App.doTextFit("#hostWord");

          if (startTime <= 0) {
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
        textFit($(el)[0], {
          alignHoriz: true,
          alignVert: false,
          widthOnly: true,
          reProcess: true,
          maxFontSize: 300,
        });
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
        IO.socket.on("connected", IO.onConnected);
        IO.socket.on("defaultConfig", App.Host.showCreateGameScreen);
        IO.socket.on("newGameCreated", IO.onNewGameCreated);
        IO.socket.on("startNewGame", IO.startNewGame);
        IO.socket.on("guestJoinedRoom", IO.guestJoinedRoom);
        IO.socket.on("beginNewGame", IO.beginNewGame);
        IO.socket.on("errorMessage", IO.error);
        IO.socket.on("newWordData", IO.onNewWordData);
        IO.socket.on("wordChecked", IO.wordChecked);
        IO.socket.on("timer", IO.timer);
        IO.socket.on("endGame", IO.endGame);
        IO.socket.on("resetGame", IO.resetGame);
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
        $(".createRoom").hide();
        $(".wait").show();
        $("#spanNewGameCode").text(App.gameId);
        $("#btnStart").hide();
        if (reset === true) {
          $("#disconnectMsg").show();
        } else {
          $("#disconnectMsg").hide();
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
        SoundFX.join();
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
        // Keep answers + definitions for hover tooltips on found words
        App.boardAnswers = data.answers || [];
        App.wordDefinitions = data.definitions || {};
        // Show the game board for the Host and the Guest
        App.newWord(data);
      },

      /**
       * Server returns the result of entered word
       * @param data {{ socketId: string, incorrectWord: boolean,
       *    alreadyTaken: boolean, word: string, index: number }}
       */
      wordChecked(data) {
        // Resolve which side made the attempt, for toast anchoring.
        let scorer = App.myRole;
        if (data.socketId !== App.mySocketId) {
          scorer = App.myRole === "Guest" ? "Host" : "Guest";
        }
        const isMine = data.socketId === App.mySocketId;

        if (data.incorrectWord === true) {
          SoundFX.wrong();
          FX.animate($("#mainTable"), "warn-anim");
          $("#mainTable td.letter").each(function flash() {
            FX.animate($(this), "flash-red");
          });
          App.showToast("Not a word", "err", scorer);
        } else if (data.alreadyTaken === true) {
          SoundFX.already();
          FX.animate($("#mainTable"), "warn-anim");
          App.showToast(`${data.word} already found`, "dup", scorer);
        } else {
          data.word = data.word.toUpperCase();
          App.updateScoreBoard(data.scoreBoard);

          const wordIndex = data.index;
          if (wordIndex !== -1) {
            const isBonus = data.word.length === App.boardMaxLen;
            const boxClass = isBonus ? "bonus" : "found";
            const $cells = $("#allWords .word-group")
              .eq(wordIndex)
              .find(".box");
            $cells.each(function iterator(i) {
              $(this).text(data.word[i]).addClass(boxClass);
              setTimeout(() => FX.animate($(this), "celebrate-anim"), i * 50);
            });
            App.updateLenLabels();

            // Feedback toast, styled per the guide (restraint).
            if (isMine) {
              App.showToast(
                isBonus
                  ? `Twist! ${data.word} +${data.word.length}`
                  : `${data.word} +${data.word.length}`,
                isBonus ? "bonus" : "ok",
                scorer,
              );
            } else {
              App.showToast(`${data.word} +${data.word.length}`, "ok", scorer);
            }

            // Only the player who found the word hears the chime.
            if (isMine) {
              SoundFX.correct();
              FX.celebrateBoard();
            } else {
              const $group = $("#allWords .word-group").eq(wordIndex);
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

          // Bump the scorer's score on the scoreboard.
          $(".playerScore").each(function bump() {
            if ($(this).data("socketID") === data.socketId) {
              FX.animate($(this).find(".score"), "score-bump");
            }
          });
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

        $("#time").text(
          time.replace(timerPattern, (value) => `0${value}`.slice(-2)),
        );

        if (data.countdown > 0 && data.countdown <= 15) {
          SoundFX.tick();
          $("#time").addClass("urgent");
        } else {
          $("#time").removeClass("urgent");
        }
      },

      /**
       * End the game and show the result
       * @param data {{ winner: string, winnerId: string }}
       */
      endGame(data) {
        App.updateScoreBoard(data.scoreBoard);
        // Hide the board and put the winner message in its place;
        // the answer grid stays visible below with everything revealed.
        $("#main").hide();
        const $result = $("#result").detach();
        $("#wordArea").prepend($result);
        $result.show();
        if (data.winner === undefined) {
          $("#result #message").text("It's a tie!");
          SoundFX.already();
        } else if (IO.socket.id === data.winnerID) {
          $("#result #message").text("Congrats! You won the game!");
          SoundFX.win();
          FX.confettiBurst(window.innerWidth / 2, window.innerHeight / 3, 80);
          setTimeout(
            () =>
              FX.confettiBurst(
                window.innerWidth / 4,
                window.innerHeight / 2,
                40,
              ),
            300,
          );
          setTimeout(
            () =>
              FX.confettiBurst(
                (window.innerWidth * 3) / 4,
                window.innerHeight / 2,
                40,
              ),
            500,
          );
        } else {
          $("#result #message").text(`${data.winner} won the game!`);
          SoundFX.lose();
        }
        IO.renderAnswerReveal(data.answers || [], data.foundWords || {});
        App.gameOver = true;
        App.doTextFit("#result #message");
      },

      /**
       * Reveal all possible words at game over by filling the
       * unsolved racks with dashed "missed" letters.
       */
      renderAnswerReveal(answers, foundWords) {
        answers.forEach((word, i) => {
          if (foundWords[word]) return;
          const $cells = $("#allWords .word-group").eq(i).find(".box");
          $cells.each(function iterator(j) {
            $(this)
              .text((word[j] || "").toUpperCase())
              .addClass("missed");
          });
        });
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
  })($),
);
