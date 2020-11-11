const fetch = require('node-fetch')

const getStickerMaker = (link) => new Promise((resolve, reject) => {
    fetch('https://st4rz.herokuapp.com/api/ttp?kata='+encodeURIComponent(link), {
        method: 'GET',
    })
    .then(async res => {
        const text = await res.json()

        resolve(text)
        
     })
    .catch(err => reject(err))
});
exports.getStickerMaker = getStickerMaker
