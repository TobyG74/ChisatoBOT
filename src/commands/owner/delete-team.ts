import type { ConfigCommands } from "../../types/structure/commands";
import { configService } from "../../core/config/config.service";

export default {
    name: "delteam",
    alias: ["deleteteam"],
    usage: "[tag]",
    category: "owner",
    description: "Delete User from Team",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        const config = configService.getConfig();
        if (message.quoted) {
            const num = message.quoted.sender.split("@")[0];
            if (config.teamNumber.includes(num)) {
                configService.updateConfig({ teamNumber: config.teamNumber.filter(n => n !== num) });
                Chisato.sendText(from, `Successfully delete @${num} from team`, message, {
                    mentions: [message.quoted.sender],
                });
            } else {
                Chisato.sendText(from, `@${num} is not in team`, message, {
                    mentions: [message.quoted.sender],
                });
            }
        } else if (message.mentions && message.mentions.length > 0) {
            let caption = `Successfully delete `;
            let updated = [...config.teamNumber];
            for (const mention of message.mentions) {
                const num = mention.split("@")[0];
                updated = updated.filter(n => n !== num);
                caption += `@${num} `;
            }
            configService.updateConfig({ teamNumber: updated });
            caption += `from team`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            const num = args[0];
            if (config.teamNumber.includes(num)) {
                configService.updateConfig({ teamNumber: config.teamNumber.filter(n => n !== num) });
                Chisato.sendText(from, `Successfully delete @${num} from team`, message, {
                    mentions: [num + "@s.whatsapp.net"],
                });
            } else {
                Chisato.sendText(from, `@${num} is not in team`, message, {
                    mentions: [num + "@s.whatsapp.net"],
                });
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
} satisfies ConfigCommands;