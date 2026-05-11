import type { ConfigCommands } from "../../types/structure/commands";
import { configService } from "../../core/config/config.service";

export default {
    name: "addteam",
    alias: ["tambahteam"],
    usage: "[tag]",
    category: "owner",
    description: "Add User to Team",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        const config = configService.getConfig();
        if (message.quoted) {
            const num = message.quoted.sender.split("@")[0];
            if (config.teamNumber.includes(num)) {
                Chisato.sendText(from, `@${num} is already in team`, message, {
                    mentions: [message.quoted.sender],
                });
            } else {
                configService.updateConfig({ teamNumber: [...config.teamNumber, num] });
                Chisato.sendText(from, `Successfully add @${num} to team`, message, {
                    mentions: [message.quoted.sender],
                });
            }
        } else if (message.mentions && message.mentions.length > 0) {
            let caption = `Successfully add `;
            const updated = [...config.teamNumber];
            for (const mention of message.mentions) {
                const num = mention.split("@")[0];
                if (!updated.includes(num)) updated.push(num);
                caption += `@${num} `;
            }
            configService.updateConfig({ teamNumber: updated });
            caption += `to team`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            const num = args[0];
            if (config.teamNumber.includes(num)) {
                Chisato.sendText(from, `@${num} is already in team`, message, {
                    mentions: [num + "@s.whatsapp.net"],
                });
            } else {
                configService.updateConfig({ teamNumber: [...config.teamNumber, num] });
                Chisato.sendText(from, `Successfully add @${num} to team`, message, {
                    mentions: [num + "@s.whatsapp.net"],
                });
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
} satisfies ConfigCommands;