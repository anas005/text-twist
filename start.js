// var fs = require('fs');
// console.log(fs.readFileSync('wordPool.json', "UTF-8"))

const words = require("./lib/words.js")
// let random_word = words.randomWord();
// console.log(words.allWords(random_word), random_word);
console.log(words.allWords("teacher"));
