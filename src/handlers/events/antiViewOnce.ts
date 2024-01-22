import clc from "cli-color";
import { ConfigEvents } from "../../types/commands";

export default <ConfigEvents>{
    name: "antiviewonce",
    isGroup: true,
    isBotAdmin: true,
    async run({ Chisato, time, pushName, groupName, from, sender, message, Database, isOwner, isGroupAdmin }) {
        const { antiviewonce } = await Database.GroupSetting.get(from);
        let buffer: Buffer;
        if (antiviewonce && !isOwner && !isGroupAdmin) {
            if (message.message[message.type].viewOnce) {
                const caption = message.message[message.type].caption ?? "-";
                console.log(
                    clc.green.bold("[ ") +
                        clc.white.bold("ANTI VIEW ONCE") +
                        clc.green.bold(" ] ") +
                        clc.blue(time) +
                        " from " +
                        clc.magenta.bold(pushName) +
                        " in " +
                        clc.yellow.bold(groupName)
                );
                if (message.type === "imageMessage") {
                    const str =
                        `*「 ANTIVIEWONCE 」*\n\n` +
                        `• *Name* : ${pushName ? pushName : sender.split("@")[0]}\n` +
                        `• *Number* : @${sender.split("@")[0]}\n` +
                        `• *Caption* : ${caption}\n` +
                        `• *Type* : ${message.type}`;
                    buffer = await Chisato.downloadMediaMessage(message);
                    await Chisato.sendImage(from, buffer, str, message, { mentions: [sender] });
                } else if (message.type === "videoMessage") {
                    const str =
                        `*「 ANTIVIEWONCE 」*\n\n` +
                        `• *Name* : ${pushName ? pushName : sender.split("@")[0]}\n` +
                        `• *Number* : @${sender.split("@")[0]}\n` +
                        `• *Caption* : ${caption}\n` +
                        `• *Type* : ${message.type}`;
                    buffer = await Chisato.downloadMediaMessage(message);
                    await Chisato.sendVideo(from, buffer, false, str, message, { mentions: [sender] });
                }
                buffer = null;
            }
        }
    },
};
