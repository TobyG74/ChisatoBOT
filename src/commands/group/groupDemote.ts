import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "demote",
    alias: ["gdemote", "groupdemote"],
    usage: "<tag|reply>",
    category: "group",
    description: "Demote Member from Group Admin",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, message, groupAdmins }) {
        if (message.quoted) {
            const mention = message.quoted.sender;
            const check = groupAdmins.map((v) => v.id).includes(mention);
            if (!check) return Chisato.sendText(from, `Sorry, this number is not in the Group Admin!`, message);
            await Chisato.groupParticipantsUpdate(from, [mention], "demote")
                .then(() =>
                    Chisato.sendText(
                        from,
                        `Successfully demoted @${mention.split("@")[0]} from Group Admin!`,
                        message,
                        { mentions: [mention] }
                    )
                )
                .catch(() => {
                    Chisato.sendText(from, `Failed to demote @${mention.split("@")[0]} from Group Admin!`, message, {
                        mentions: [mention],
                    });
                });
        } else if (message.mentions) {
            const mention = message.mentions;
            for (let i in mention) {
                const check = groupAdmins.map((v) => v.id).includes(mention[i]);
                if (!check) return Chisato.sendText(from, `Sorry, this number is not in the Group Admin!`, message);
                await Chisato.groupParticipantsUpdate(from, [mention[i]], "demote")
                    .then(() =>
                        Chisato.sendText(
                            from,
                            `Successfully demoted @${mention[i].split("@")[0]} from Group Admin!`,
                            message,
                            { mentions: [mention[i]] }
                        )
                    )
                    .catch(() => {
                        Chisato.sendText(
                            from,
                            `Failed to demote @${mention[i].split("@")[0]} from Group Admin!`,
                            message,
                            { mentions: [mention[i]] }
                        );
                    });
            }
        } else {
            const caption = `Example :

*With Tag*
• /demote @6281311850715

*With Reply Message*
• /demote`;
            Chisato.sendText(from, caption, message);
        }
    },
};
