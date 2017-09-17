"use strict"

// let dictionary = JSON.parse(
//     require('fs').readFileSync('./assets/dictionary.json')
// );

// dictionary = Object.keys(dictionary);

let gameWords = word => 3 <= word.length || word.length <= 7;

let dictionary = require('./dictionary.json').dictionary.filter(gameWords);

// const _ = require("underscore");

let subsets = require('./subset.js');
let permutator = require('./permutator.js').permutator;

let isCorrectWord = word => !!~dictionary.indexOf(word);

// let noVowelRegExp = /^[^aeiou]+$/i;
// let nonVowelWord = word => noVowelRegExp.test(word);
const uniq = arr => [...new Set(arr)];

// let allLetterWord = word => uniq(word.toLowerCase().split("")).length == 15;
let sevenLetterWords = dictionary.filter(word => word.length == 7);

let i = 0;
// dictionary.filter(nonVowelWord).forEach(word => console.log(++i, word));
// dictionary.filter(allLetterWord).forEach(word => console.log(++i, word));

function findAllWords(word) {
  let allWords = [];
  word = word.split("").map(w => w.toUpperCase());
  let wordsToCheck = subsets.getSubsets(word, 3);
  wordsToCheck.forEach(wArr => {
    permutator(wArr).map(w => w.join("")).forEach(word => allWords.push(word));
  });
  // allWords = _(allWords).unique();
  return uniq(allWords).filter(isCorrectWord);
}

function getRandomWord() {
  return sevenLetterWords[Math.floor(Math.random()*sevenLetterWords.length)];
}

// let allWords = findAllWords("farmer");
// console.log(allWords);

exports.allWords = findAllWords;
exports.randomWord = getRandomWord;
