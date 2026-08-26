/**
 * Game board: building, tile swapping, shuffling and recalling letters.
 * Requires jQuery, SoundFX and FX (loaded before this file).
 */
/* eslint-env browser */
/* eslint-env jquery */

/* eslint-disable no-param-reassign */
window.Board = {
  /**
   * Generate board tiles + grouped answer grid.
   * @param {string} word The shuffled source word
   * @param {number[]} allWordsLength Lengths of every valid word
   * @returns {{ maxLen: number }} length of the longest possible word
   */
  generateBoard(word, allWordsLength) {
    const mainRow = $('#mainTable tr').empty();
    const shuffledRow = $('#shuffledTable tr').empty();

    for (let i = 0; i < word.length; i += 1) {
      mainRow.append($('<td></td>').addClass('empty'));
      const $tile = $('<td></td>').addClass('letter');
      $('<span class="tl"></span>').text(word[i]).appendTo($tile);
      shuffledRow.append($tile);
    }

    // Build grouped answer grid (racks stay in server order,
    // so index i still corresponds to allWordsLength[i]).
    const $wrap = $('#allWords').empty();
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
    window.Board.updateLenLabels();

    return { maxLen: word.length };
  },

  /**
   * Update "N LETTERS · X/Y" counters on each group row.
   */
  updateLenLabels() {
    $('#allWords .len-row').each(function label() {
      const $groups = $(this).find('.word-group');
      const len = $groups.first().find('.box').length;
      const solved = $groups.filter(function isSolved() {
        return $(this).find('.box.found, .box.bonus').length > 0;
      }).length;
      $(this).find('.len-label').text(`${len} LETTERS · ${solved}/${$groups.length}`);
    });
  },

  /**
   * Javascript implementation of Fisher-Yates shuffle algorithm
   * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
   */
  shuffleArray(array) {
    let currentIndex = array.length;
    while (currentIndex !== 0) {
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      const temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  },

  /**
   * Swap two DOM elements between the tables.
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
   * Shuffle letters present on the rack.
   */
  shuffleLetters() {
    window.SoundFX.shuffle();
    const letters = $('#shuffledTable td').toArray();
    window.Board.shuffleArray(letters);
    for (let i = 0; i < letters.length; i += 1) {
      $('#shuffledTable tr').append(letters[i]);
    }
    // Wrist-twist flip in place — the arc transform lives on the
    // tile, the flip animates the inner letter so it stays put.
    $('#shuffledTable td .tl').each(function stagger(i) {
      const $span = $(this);
      setTimeout(() => {
        $span.addClass('flip-anim').one('animationend', function onEnd() {
          $(this).removeClass('flip-anim');
        });
      }, i * 40);
    });
  },

  /**
   * Recall all entered letters back to the rack.
   */
  recallLetters() {
    window.SoundFX.sweep(700, 250, 0.2, 'triangle', 0.1);
    $('#mainTable .letter').each(function iterator() {
      window.Board.swap($(this), $('#shuffledTable .empty:eq(0)'));
    });
  },

  /**
   * Delegated click handler: move a letter between rack and word row.
   * `this` is the clicked table cell.
   */
  handleLetterClick() {
    // Guard against duplicated tap/click events on touch devices,
    // otherwise the letter swaps twice and appears to never move.
    const now = Date.now();
    const $tile = $(this);
    const lastClick = $tile.data('lastClick') || 0;
    if (now - lastClick < 300) return;
    $tile.data('lastClick', now);

    const thisTableId = $tile.closest('table').attr('id');
    const position = thisTableId === 'mainTable' ? 'last' : 'first';
    const $destination = $(`div#main table:not(#${thisTableId}) td.empty:${position}`);
    window.Board.swap($tile, $destination);
    if (thisTableId === 'shuffledTable') {
      window.SoundFX.select();
    } else {
      window.SoundFX.deselect();
    }
    window.FX.animate($destination, 'pop-anim');
  },
};

/**
 * jQuery helper used by Board.swap to reposition elements.
 */
/* eslint-env jquery */
jQuery.fn.insertAt = function insertAt(index, $parent) {
  return this.each(function onEach() {
    if (index === 0) {
      $parent.prepend(this);
    } else {
      $parent.children().eq(index - 1).after(this);
    }
  });
};
