let subsets = require('./subset.js');
let dictionaryJSON = JSON.parse(
    require('fs').readFileSync('./assets/masterDictionary.json')
);

// https://stackoverflow.com/a/12477976/5193103
const dictionary = dictionaryJSON.reduce((accumulator, value) => {
  accumulator.push(value.word);
  return accumulator;
}, []);

const sorted_dict = dictionary.reduce((accumulator, value) => {
  var value_sorted = value.split("").sort().join("");
  if (!accumulator[value_sorted]) accumulator[value_sorted] = [];
  accumulator[value_sorted].push(value);
  return accumulator;
}, {});


const uniq = arr => [...new Set(arr)];

let sevenLetterWords = dictionary.filter(word => word.length == 7);

function findAllWords(word) {
  let allWords = [];
  word = word.toLowerCase().split("").sort();
  let wordsToCheck = uniq(subsets.getSubsets(word, 3));
  wordsToCheck.forEach(sorted_word => {
    let anagram = sorted_dict[sorted_word];
    if (anagram) {
		allWords.push(...anagram);
    }
  });
  return allWords;
}

function getRandomWord() {
  return sevenLetterWords[Math.floor(Math.random()*sevenLetterWords.length)];
}

exports.allWords = findAllWords;
exports.randomWord = getRandomWord;
exports.dictionary = dictionaryJSON;