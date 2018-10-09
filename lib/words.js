let subsets = require('./subsets');
let dictionaryJSON = JSON.parse(
    require('fs').readFileSync('./assets/masterDictionary.json')
);
let hotBoard = JSON.parse(
    require('fs').readFileSync('./assets/hotBoard.json')
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

function findAllWords(word) {
    let allWords = [];
    word = word.toLowerCase().split("").sort();
    let wordsToCheck = uniq(subsets(word, 3));
    wordsToCheck.forEach(sorted_word => {
        let anagram = sorted_dict[sorted_word];
        if (anagram) {
            allWords.push(...anagram);
        }
    });
    return allWords;
}

function getRandomWord(length) {
    const lengthMap = {
        "5": "fiveLetterWords",
        "6": "sixLetterWords",
        "7": "sevenLetterWords",
        "8": "eightLetterWords"
    }
    let allWords = hotBoard[lengthMap[length]];
    return allWords[Math.floor(Math.random() * allWords.length)];
}

module.exports = {
    allWords: findAllWords,
    randomWord: getRandomWord,
    dictionary: dictionaryJSON
}
