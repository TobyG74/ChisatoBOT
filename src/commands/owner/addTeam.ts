import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

export default <ConfigCommands>{
    name: "addteam",
    alias: ["tambahteam"],
    usage: "<tag>",
    category: "owner",
    description: "Add User to Team",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        if (message.quoted) {
            if (config.teamNumber.includes(message.quoted.sender.split("@")[0])) {
                Chisato.sendText(from, `@${message.quoted.sender.split("@")[0]} is already in team`, message, {
                    mentions: [message.quoted.sender],
                });
            } else {
                config.teamNumber.push(message.quoted.sender.split("@")[0]);
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                Chisato.sendText(from, `Successfully add @${message.quoted.sender.split("@")[0]} to team`, message, {
                    mentions: [message.quoted.sender],
                });
            }
        } else if (message.mentions) {
            let caption = `Successfully add `;
            for (let i in message.mentions) {
                if (config.teamNumber.includes(message.mentions[i].split("@")[0])) {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                } else {
                    config.teamNumber.push(message.mentions[i].split("@")[0]);
                    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                    caption += `@${message.mentions[i].split("@")[0]} `;
                }
            }
            caption += `to team`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            if (config.teamNumber.includes(args[0] + "@s.whatsapp.net")) {
                Chisato.sendText(from, `@${args[0]} is already in team`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            } else {
                config.teamNumber.push(args[0] + "@s.whatsapp.net");
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                Chisato.sendText(from, `Successfully add @${args[0]} to team`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
