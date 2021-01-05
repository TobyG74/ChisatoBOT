const fetch = require('node-fetch')
const axios = require('axios')
const fs = require('fs-extra')
let setting = JSON.parse(fs.readFileSync('./lib/database/setting.json'))
let { 
    vhtearkey,
    melodickey
    } = setting

const instagram = async (url) => new Promise(async (resolve, reject) => {
    const api = `http://melodicxt.herokuapp.com/api/instagram-downloader?url=${url}&apiKey=${melodickey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

const tiktok = async (url) => new Promise(async (resolve, reject) => {
    const api = `https://api.vhtear.com/tiktokdl?link=${url}&apikey=${vhtearkey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

const facebook = async (url) => new Promise(async (resolve, reject) => {
    const api = `https://api.vhtear.com/fbdl?link=${url}&apikey=${vhtearkey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

const smule = async (url) => new Promise(async (resolve, reject) => {
    const api = `https://api.vhtear.com/getsmule?link=${url}&apikey=${vhtearkey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

const starmaker = async (url) => new Promise(async (resolve, reject) => {
    const api = `https://api.vhtear.com/starmakerdl?link=${url}&apikey=${vhtearkey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

const twitter = async (url) => new Promise(async (resolve, reject) => {
    const api = `https://api.vhtear.com/twitter?link=${url}&apikey=${vhtearkey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

const joox = async (url) => new Promise(async (resolve, reject) => {
    const api = `https://api.vhtear.com/music?query=${url}&apikey=${vhtearkey}`
    axios.get(api).then(async(res) => {
        const st = res.data.result[0]
        if(st.status === false){
            resolve(`Media Tidak Di Temukan`)
        }else{
            resolve(st)
        }
    }).catch(err => {
        console.log(err)
        resolve(`Maaf, Server Sedang Error`)
    })
})

exports.instagram = instagram;
exports.tiktok = tiktok;
exports.facebook = facebook;
exports.smule = smule;
exports.starmaker = starmaker;
exports.twitter = twitter;
exports.joox = joox;
