const fetch = require('node-fetch')
const axios = require('axios')
const fs = require('fs-extra')
let setting = JSON.parse(fs.readFileSync('./lib/database/setting.json'))
const { getBase64, fetchBase64 } = require("./fetcher")
let { 
    vhtearkey
    } = setting

const stickerlight = (imageUrl) => new Promise((resolve, reject) => {
    fetch(`https://api.vhtear.com/lightning?link=${encodeURIComponent(imageUrl)}&apikey=${vhtearkey}`, {
        method: 'GET',
    })
    .then(async res => {
        const text = await res.json()

        resolve(text)
        
     })
    .catch(err => reject(err))
});

const stickerburn = (imageUrl) => new Promise((resolve, reject) => {
    fetch(`https://api.vhtear.com/burning_fire?link=${encodeURIComponent(imageUrl)}&apikey=${vhtearkey}`, {
        method: 'GET',
    })
    .then(async res => {
        const text = await res.json()

        resolve(text)
        
     })
    .catch(err => reject(err))
});

exports.stickerburn = stickerburn;
exports.stickerlight = stickerlight;
