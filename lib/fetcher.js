const fetch = require('node-fetch')
const FormData = require('form-data')
const fs = require('fs')
const { fromBuffer } = require('file-type')
const resizeImage = require('./imageProcessing')
const setting = JSON.parse(fs.readFileSync('./lib/database/setting.json'))
let {
    vhtearkey,
    barbarkey
    } = setting

const getBase64 = async (url) => {
    const response = await fetch(url, { headers: { 'User-Agent': 'okhttp/4.5.0' } });
    if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
    const buffer = await response.buffer();
    const videoBase64 = `data:${response.headers.get('content-type')};base64,` + buffer.toString('base64');
    if (buffer)
        return videoBase64;
};

const uploadImages = (buffData, type) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        const { ext } = await fromBuffer(buffData)
        const filePath = 'media/tmp.' + ext
        const _buffData = type ? await resizeImage(buffData, false) : buffData
        fs.writeFile(filePath, _buffData, { encoding: 'base64' }, (err) => {
            if (err) return reject(err)
            console.log('Uploading image to telegra.ph server...')
            const fileData = fs.readFileSync(filePath)
            const form = new FormData()
            form.append('file', fileData, 'tmp.' + ext)
            fetch('https://telegra.ph/upload', {
                method: 'POST',
                body: form
            })
                .then(res => res.json())
                .then(res => {
                    if (res.error) return reject(res.error)
                    resolve('https://telegra.ph' + res[0].src)
                })
                .then(() => fs.unlinkSync(filePath))
                .catch(err => reject(err))
        })
    })
}

const fetchBase64 = (url, mimetype) => {
    return new Promise((resolve, reject) => {
        console.log('Get base64 from:', url)
        return fetch(url)
            .then((res) => {
                const _mimetype = mimetype || res.headers.get('content-type')
                res.buffer()
                    .then((result) => resolve(`data:${_mimetype};base64,` + result.toString('base64')))
            })
            .catch((err) => {
                console.error(err)
                reject(err)
            })
    })
}

const stickerlight = (imageUrl) => new Promise((resolve, reject) => {
    fetch(`https://api.vhtear.com/lightning?link=$+encodeURIComponent(imageUrl)&apikey=${vhtearkey}`, {
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

const custom = async (imageUrl, top, bott = '') => new Promise((resolve, reject) => {
	topText = top.replace(/ /g, '%20').replace('\n','%5Cn')
    fetchBase64(`https://api.memegen.link/images/custom/${topText}/${bott}.png?background=${imageUrl}`, 'image/png')
        .then((result) => resolve(result))
        .catch((err) => {
            console.error(err)
            reject(err)
        })
})

exports.stickerburn = stickerburn;
exports.uploadImages = uploadImages;
exports.fetchBase64 = fetchBase64
exports.custom = custom;
exports.getBase64 = getBase64;
exports.stickerlight = stickerlight;
