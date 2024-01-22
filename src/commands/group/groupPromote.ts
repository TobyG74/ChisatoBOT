import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "promote",
    alias: ["gpromote", "grouppromote"],
    usage: "<tag>",
    category: "group",
    description: "Promote Member to Group Admin",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, message, groupAdmins }) {
        if (message.quoted) {
            const mention = message.quoted.sender;
            const check = groupAdmins.map((v) => v.id).includes(mention);
            if (check) return Chisato.sendText(from, `Sorry, the Number is already a Group Admin!`, message);
            await Chisato.groupParticipantsUpdate(from, [mention], "promote")
                .then(() =>
                    Chisato.sendText(from, `Successfully promoted @${mention.split("@")[0]} to Group Admin!`, message, {
                        mentions: [mention],
                    })
                )
                .catch(() => {
                    Chisato.sendText(from, `Failed to promote @${mention.split("@")[0]} to Group Admin!`, message, {
                        mentions: [mention],
                    });
                });
        } else if (message.mentions) {
            const mention = message.mentions;
            for (let i in mention) {
                const check = groupAdmins.map((v) => v.id).includes(mention[i]);
                if (check) return Chisato.sendText(from, `Sorry, the Number is already a Group Admin!`, message);
                await Chisato.groupParticipantsUpdate(from, [mention[i]], "promote")
                    .then(() =>
                        Chisato.sendText(
                            from,
                            `Successfully promoted @${mention[i].split("@")[0]} to Group Admin!`,
                            message,
                            { mentions: [mention[i]] }
                        )
                    )
                    .catch(() => {
                        Chisato.sendText(
                            from,
                            `Failed to promote @${mention[i].split("@")[0]} to Group Admin!`,
                            message,
                            { mentions: [mention[i]] }
                        );
                    });
            }
        } else {
            const caption = `Example :

*With Tag*
• /promote @6281311850715

*With Reply Message*
• /promote`;
            Chisato.sendText(from, caption, message);
        }
    },
};
