var fs = require('fs');
const words = require("./lib/words.js")

let wordPool = {};

// for (let i = 0; i < 10; i++) {
for (let i = 0; i < 3; i++) {
	let randomWord = words.randomWord();
	wordPool[randomWord] = words.allWords(randomWord);
}

wordPool = JSON.stringify(wordPool);

fs.writeFile('wordPool.json', wordPool, 'utf8', () => console.log("File has been succuessfully written!!!"));