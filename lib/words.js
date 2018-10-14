/* eslint-disable no-param-reassign */

const masterDictionary = require('../assets/masterDictionary.json');
const hotBoard = require('../assets/hotBoard.json');
const subsets = require('./subsets');

/**
 * Below code uses an algorithm mentioned in
 * https://stackoverflow.com/a/12477976/5193103
 * to find Anagrams of a given word
 */

/**
 * Create an array of all words in dictionary
 */
const dictionary = masterDictionary.reduce((accumulator, value) => {
  accumulator.push(value.word);
  return accumulator;
}, []);

/**
 * Sort each word's letters alphabetically
 */
const sortedDict = dictionary.reduce((accumulator, value) => {
  const valueSorted = value.split('').sort().join('');
  if (!accumulator[valueSorted]) accumulator[valueSorted] = [];
  accumulator[valueSorted].push(value);
  return accumulator;
}, {});

/**
 * Find unique elements in a array
 * @param arr The array
 */
const uniq = arr => [...new Set(arr)];

/**
 * Find all the possible Anagrams from a given word
 * @param word The word for which anagram needs to be found
 */
const findAllWords = (word) => {
  const allWords = [];
  word = word.toLowerCase().split('').sort();
  const wordsToCheck = uniq(subsets(word, 3));
  wordsToCheck.forEach((sortedWord) => {
    const anagram = sortedDict[sortedWord];
    if (anagram) {
      allWords.push(...anagram);
    }
  });
  return allWords.sort((a, b) => a.length - b.length || a.localeCompare(b));
};

/**
 * Get a random word from dictionary having given length
 * @param length The word length
 */
const getRandomWord = (length) => {
  const lengthMap = {
    5: 'fiveLetterWords',
    6: 'sixLetterWords',
    7: 'sevenLetterWords',
    8: 'eightLetterWords',
  };
  const allWords = hotBoard[lengthMap[length]];
  return allWords[Math.floor(Math.random() * allWords.length)];
};

module.exports = {
  allWords: findAllWords,
  randomWord: getRandomWord,
  dictionary: masterDictionary,
};
