import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "kick",
    alias: ["gkick", "groupkick"],
    usage: "<tag>",
    category: "group",
    description: "Kick Member From Group",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, botNumber, message }) {
        if (message.quoted) {
            const mention = message.quoted.sender;
            if (mention === botNumber) return;
            Chisato.groupParticipantsUpdate(from, [mention], "remove")
                .then(() =>
                    Chisato.sendText(from, `Successfully removed @${mention.split("@")[0]} from the Group!`, message, {
                        mentions: [mention],
                    })
                )
                .catch(() =>
                    Chisato.sendText(from, `Failed to remove group member!`, message, {
                        mentions: [mention],
                    })
                );
        } else if (message.mentions) {
            const mention = message.mentions;
            for (let i in mention) {
                if (mention[i] === botNumber) return;
                Chisato.groupParticipantsUpdate(from, [mention[i]], "remove")
                    .then(() =>
                        Chisato.sendText(
                            from,
                            `Successfully removed @${mention[i].split("@")[0]} from the Group!`,
                            message,
                            { mentions: [mention[i]] }
                        )
                    )
                    .catch(() => {
                        Chisato.sendText(from, `Failed to remove group member!`, message, {
                            mentions: [mention[i]],
                        });
                    });
            }
        } else {
            const caption = `Example :

*With Tag*
• /kick @6281311850715

*With Reply Message*
• /kick`;
            Chisato.sendText(from, caption, message);
        }
    },
};
