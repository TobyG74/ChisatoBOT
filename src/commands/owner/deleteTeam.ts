import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

export default <ConfigCommands>{
    name: "delteam",
    alias: ["deleteteam"],
    usage: "<tag>",
    category: "owner",
    description: "Delete User from Team",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        if (message.quoted) {
            if (config.teamNumber.includes(message.quoted.sender.split("@")[0])) {
                config.teamNumber.splice(config.teamNumber.indexOf(message.quoted.sender.split("@")[0]), 1);
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                Chisato.sendText(
                    from,
                    `Successfully delete @${message.quoted.sender.split("@")[0]} from team`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            } else {
                Chisato.sendText(from, `@${message.quoted.sender.split("@")[0]} is not in team`, message, {
                    mentions: [message.quoted.sender],
                });
            }
        } else if (message.mentions) {
            let caption = `Successfully delete `;
            for (let i in message.mentions) {
                if (config.teamNumber.includes(message.mentions[i].split("@")[0])) {
                    config.teamNumber.splice(config.teamNumber.indexOf(message.mentions[i].split("@")[0]), 1);
                    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                    caption += `@${message.mentions[i].split("@")[0]} `;
                } else {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                }
            }
            caption += `from team`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            if (config.teamNumber.includes(args[0] + "@s.whatsapp.net")) {
                config.teamNumber.splice(config.teamNumber.indexOf(args[0] + "@s.whatsapp.net"), 1);
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                Chisato.sendText(from, `Successfully delete @${args[0]} from team`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            } else {
                Chisato.sendText(from, `@${args[0]} is not in team`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
