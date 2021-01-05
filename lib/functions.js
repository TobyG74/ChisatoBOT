const fetch = require('node-fetch')
const { default: got } = require('got/dist/source');
const { getBase64, fetchBase64 } = require("./fetcher")
const request = require('request')
const emoji = require('emoji-regex')
const fs = require('fs-extra')
const axios = require('axios')
const moment = require('moment-timezone')
const { default: translate } = require('google-translate-open-api')
const { melodickey } = JSON.parse(fs.readFileSync('./lib/database/setting.json'))
moment.tz.setDefault('Asia/Jakarta').locale('id')

const liriklagu = async (lagu) => {
    const response = await fetch(`http://scrap.terhambar.com/lirik?word=${lagu}`)
    if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
    const json = await response.json()
    if (json.status === true) return `Lirik Lagu ${lagu}\n\n${json.result.lirik}`
    return `[ Error ] Lirik Lagu ${lagu} tidak di temukan!`
}

const processTime = (timestamp, now) => {
    // timestamp => timestamp when message was received
    return moment.duration(now - moment(timestamp * 1000)).asSeconds()
}
/**
 * is it url?
 * @param  {String} url
 */

const quotemaker = async (quotes, author = 'EmditorBerkelas', type = 'random') => {
    var q = quotes.replace(/ /g, '%20').replace('\n','%5Cn')
    const response = await fetch(`https://terhambar.com/aw/qts/?kata=${q}&author=${author}&tipe=${type}`)
    if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)
    const json = await response.json()
    if (json.status) {
        if (json.result !== '') {
            const base64 = await getBase64(json.result)
            return base64
        }
    }
}

const emojiStrip = (string) => {
    return string.replace(emoji, '')
}
/*
const ss = async(query) => {
    request({
        url: "https://api.apiflash.com/v1/urltoimage",
        encoding: "binary",
        qs: {
            access_key: "2fc9726e595d40eebdf6792f0dd07380",
            url: query
        }
    }, (error, response, body) => {
        if (error) {
            console.log(error);
        } else {
            fs.writeFile("./media/img/screenshot.jpeg", body, "binary", error => {
                console.log(error);
            })
        }
    })
}

const doing = async (text, lang) => new Promise((resolve, reject) => {
    console.log(`Translate text to ${lang}...`)
    translate(text, { tld: 'cn', to: lang })
        .then((text) => resolve(text.data[0]))
        .catch((err) => reject(err))
})*/

const randomNimek = async (type) => {
    var url = 'https://api.computerfreaker.cf/v1/'
    switch(type) {
        case 'nsfw':
            const nsfw = await fetch(url + 'nsfwneko')
            if (!nsfw.ok) throw new Error(`unexpected response ${nsfw.statusText}`)
            const resultNsfw = await nsfw.json()
            return resultNsfw.url
            break
        case 'hentai':
            const hentai = await fetch(url + 'hentai')
            if (!hentai.ok) throw new Error(`unexpected response ${hentai.statusText}`)
            const resultHentai = await hentai.json()
            return resultHentai.url
            break
        case 'anime':
            let anime = await fetch(url + 'anime')
            if (!anime.ok) throw new Error(`unexpected response ${anime.statusText}`)
            const resultNime = await anime.json()
            return resultNime.url
            break
        case 'neko':
            let neko = await fetch(url + 'neko')
            if (!neko.ok) throw new Error(`unexpected response ${neko.statusText}`)
            const resultNeko = await neko.json()
            return resultNeko.url
            break
        case 'trap':
            let trap = await fetch(url + 'trap')
            if (!trap.ok) throw new Error(`unexpected response ${trap.statusText}`)
            const resultTrap = await trap.json()
            return resultTrap.url
            break
    }
}

const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const jadwalTv = async (query) => {
    const res = await axios.get(`http://melodicxt.herokuapp.com/api/jadwaltv?query=${query}&apiKey=${melodickey}`)
    const ress = res.data.result[0]
    if (ress.error) return ress.error
    switch(query) {
        case 'antv':
            return `\t\t[ ANTV ]\n${ress.join('\n')}`
            break
        case 'gtv':
            return `\t\t[ GTV ]\n${ress.join('\n')}`
            break
        case 'indosiar':
            return `\t\t[ INDOSIAR ]\n${ress.join('\n')}`
            break
        case 'inewstv':
            return `\t\t[ iNewsTV ]\n${ress.join('\n')}`
            break
        case 'kompastv':
            return `\t\t[ KompasTV ]\n${ress.join('\n')}`
            break
        case 'mnctv':
            return `\t\t[ MNCTV ]\n${ress.join('\n')}`
            break
        case 'metrotv':
            return `\t\t[ MetroTV ]\n${ress.join('\n')}`
            break
        case 'nettv':
            return `\t\t[ NetTV ]\n${ress.join('\n')}`
            break
        case 'rcti':
            return `\t\t[ RCTI ]\n${ress.join('\n')}`
            break
        case 'sctv':
            return `\t\t[ SCTV ]\n${ress.join('\n')}`
            break
        case 'rtv':
            return `\t\t[ RTV ]\n${ress.join('\n')}`
            break
        case 'trans7':
            return `\t\t[ Trans7 ]\n${ress.join('\n')}`
            break
        case 'transtv':
            return `\t\t[ TransTV ]\n${ress.join('\n')}`
            break
        default:
            return '[ ERROR ] Channel TV salah! silahkan cek list channel dengan mengetik perintah *!listChannel*'
            break
    }
}

const random = (subreddit) => new Promise((resolve, reject) => {
    const subreddits = ['dankmemes', 'wholesomeanimemes', 'wholesomememes', 'AdviceAnimals', 'MemeEconomy', 'memes', 'terriblefacebookmemes', 'teenagers', 'historymemes']
    const randSub = subreddits[Math.random() * subreddits.length | 0]
    console.log('looking for memes on ' + randSub)
    fetchJson('https://meme-api.herokuapp.com/gimme/' + randSub)
        .then((result) => resolve(result))
        .catch((err) => {
            console.error(err)
            reject(err)
        })
})


/**
 * create custom meme
 * @param  {String} imageUrl
 * @param  {String} topText
 * @param  {String} bottomText
 */


exports.liriklagu = liriklagu;
exports.quotemaker = quotemaker;
exports.randomNimek = randomNimek;
exports.processTime = processTime;
exports.emojiStrip = emojiStrip;
exports.sleep = sleep;
exports.jadwalTv = jadwalTv;
exports.random = random;
