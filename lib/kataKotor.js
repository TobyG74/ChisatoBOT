const sastrawi = require('sastrawijs');
const fs = require('fs')
let kataKasar = JSON.parse(fs.readFileSync('./lib/database/katakasar.json'))
var sorted = [];
for (var i = 0; i < kataKasar.length; i++) {
    sorted.push(kataKasar[i].toLowerCase());
}
sorted.sort();

const inArray = (needle, haystack) => {
    let length = haystack.length;
    for(let i = 0; i < length; i++) {
        if(haystack[i] == needle) return true;
    }
    return false;
}

module.exports = cariKasar = (kata) => new Promise((resolve, reject) => {
    let sentence = kata;
    let stemmer = new sastrawi.Stemmer();
    let tokenizer = new sastrawi.Tokenizer();
    let words = tokenizer.tokenize(sentence);
    for (word of words) {
        if(inArray(stemmer.stem(word), sorted)){
            resolve(true)
        }
    }
    resolve(false)
})
