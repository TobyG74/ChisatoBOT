import clc from "cli-color";
import { ConfigEvents } from "../../types/commands";

export default <ConfigEvents>{
    name: "antibot",
    isGroup: true,
    isBotAdmin: true,
    async run({ Chisato, time, groupName, from, sender, pushName, message, Database, isOwner, isGroupAdmin }) {
        const { antibot } = await Database.GroupSetting.get(from);
        if (antibot && !isOwner && !isGroupAdmin) {
            if (
                (message.key.id.startsWith("BAE5") && message.key.id.length === 16) ||
                (message.key.id.startsWith("3EB0") && message.key.id.length === 12)
            ) {
                console.log(
                    clc.green.bold("[ ") +
                        clc.white.bold("ANTI BOT") +
                        clc.green.bold(" ] ") +
                        clc.blue(time) +
                        " from " +
                        clc.magenta.bold(pushName) +
                        " in " +
                        clc.yellow.bold(groupName)
                );
                const caption =
                    `*「 ANTIBOT 」*\n\n` + `• *Name* : ${pushName}\n` + `• *Number* : @${sender.split("@")[0]}`;
                Chisato.sendText(from, caption, message, { mentions: [sender] });
                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
            }
        }
    },
};
