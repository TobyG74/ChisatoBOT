import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "getpicture",
    alias: ["getpic"],
    category: "group",
    usage: "<tag>",
    description: "Get Picture Profile",
    async run({ Chisato, from, message }) {
        let picture: string;
        if (message.mentions) {
            for (let i in message.mentions) {
                try {
                    picture = await Chisato.profilePictureUrl(message.mentions[i], "image");
                    Chisato.sendImage(from, picture, null, message, {
                        caption: `@${message.mentions[i].split("@")[0]}`,
                        contextInfo: {
                            mentionedJid: [message.mentions[i]],
                        },
                    });
                } catch {
                    Chisato.sendText(
                        from,
                        `@${message.mentions[i].split("@")[0]} doesn't have profile picture!`,
                        message,
                        {
                            mentions: [message.mentions[i]],
                        }
                    );
                }
            }
        } else if (message.quoted) {
            try {
                picture = await Chisato.profilePictureUrl(message.quoted.sender, "image");
                Chisato.sendImage(from, picture, null, message, {
                    caption: `@${message.quoted.sender.split("@")[0]}`,
                    contextInfo: {
                        mentionedJid: [message.quoted.sender],
                    },
                });
            } catch {
                Chisato.sendText(
                    from,
                    `@${message.quoted.sender.split("@")[0]} doesn't have profile picture!`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
