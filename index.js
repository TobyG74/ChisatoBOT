const { create, Client } = require('@open-wa/wa-automate')
const welcome = require('./lib/welcome')
const left = require('./lib/left')
const msgHandler = require('./tobz')
const options = require('./options')
const fs = require('fs-extra')

const adminNumber = JSON.parse(fs.readFileSync('./lib/admin.json'))
const setting = JSON.parse(fs.readFileSync('./lib/setting.json'))
const isWhite = (chatId) => adminNumber.includes(chatId) ? true : false

let { 
    limitCount,
    memberLimit, 
    groupLimit,
    mtc: mtcState,
    banChats,
    restartState: isRestart
    } = setting

const start = async (tobz = new Client()) => {
        console.log('[SERVER] Server Started!')
        // Force it to keep the current session
        tobz.onStateChanged((state) => {
            console.log('[Client State]', state)
            if (state === 'CONFLICT' || state === 'UNLAUNCHED') tobz.forceRefocus()
        })
        // listening on message
        tobz.onMessage((async (message) => {
            tobz.getAmountOfLoadedMessages()
            .then((msg) => {
                if (msg >= 3000) {
                    tobz.cutMsgCache()
                }
            })
            msgHandler(tobz, message)
        }))

        tobz.onGlobalParicipantsChanged((async (heuh) => {
            await welcome(tobz, heuh) 
            left(tobz, heuh)
            }))
        
        tobz.onAddedToGroup(async (chat) => {
            if(isWhite(chat.id)) return tobz.sendText(chat.id, 'Halo aku Elaina, Ketik #help Untuk Melihat List Command Ku...')
            if(mtcState === false){
                const groups = await tobz.getAllGroups()
                // BOT group count less than
                if(groups.length > groupLimit){
                    await tobz.sendText(chat.id, 'Maaf, Batas group yang dapat Elaina tampung sudah penuh').then(async () =>{
                        tobz.deleteChat(chat.id)
                        tobz.leaveGroup(chat.id)
                    })
                }else{
                    if(chat.groupMetadata.participants.length < memberLimit){
                        await tobz.sendText(chat.id, `Maaf, BOT keluar jika member group tidak melebihi ${memberLimit} orang`).then(async () =>{
                            tobz.deleteChat(chat.id)
                            tobz.leaveGroup(chat.id)
                        })
                    }else{
                        if(!chat.isReadOnly) tobz.sendText(chat.id, 'Halo aku Elaina, Ketik #help Untuk Melihat List Command Ku...')
                    }
                }
            }else{
                await tobz.sendText(chat.id, 'Elaina sedang maintenance, coba lain hari').then(async () => {
                    tobz.deleteChat(chat.id)
                    tobz.leaveGroup(chat.id)
                })
            }
        })

        /*tobz.onAck((x => {
            const { from, to, ack } = x
            if (x !== 3) tobz.sendSeen(to)
        }))*/

        // listening on Incoming Call
        tobz.onIncomingCall(( async (call) => {
            await tobz.sendText(call.peerJid, 'Maaf, saya tidak bisa menerima panggilan. nelfon = block!.\nJika ingin membuka block harap chat Owner!')
            .then(() => tobz.contactBlock(call.peerJid))
        }))
    }

create('Elaina', options(true, start))
    .then(tobz => start(tobz))
    .catch((error) => console.log(error))
