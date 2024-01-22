import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "delpremium",
    alias: ["deletepremium"],
    usage: "<tag>",
    category: "owner",
    description: "Add Premium User",
    isOwner: true,
    async run({ Chisato, args, from, message, Database }) {
        if (message.quoted) {
            let user = await Database.User.get(message.quoted.sender);
            if (user.role === "premium") {
                await Database.User.update(message.quoted.sender, {
                    role: "free",
                    expired: 0,
                }).then(async () => {
                    await Chisato.sendText(
                        from,
                        `Successfully delete @${message.quoted.sender.split("@")[0]} from premium user`,
                        message,
                        {
                            mentions: [message.quoted.sender],
                        }
                    );
                    Chisato.sendText(message.quoted.sender, `You are no longer premium user!`, message);
                });
            } else {
                Chisato.sendText(
                    message.quoted.sender,
                    `@${message.quoted.sender.split("@")[0]} is not premium user`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            }
        } else if (message.mentions) {
            let caption = `Successfully delete `;
            for (let i in message.mentions) {
                let user = await Database.User.get(message.mentions[i]);
                if (user.role === "premium") {
                    await Database.User.update(message.mentions[i], {
                        role: "free",
                        expired: 0,
                    }).then(() => {
                        caption += `@${message.mentions[i].split("@")[0]} `;
                    });
                } else {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                }
                Chisato.sendText(from, `You are no longer premium user!`);
            }
            caption += `from premium user`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            let user = await Database.User.get(args[0] + "@s.whatsapp.net");
            if (user.role === "premium") {
                await Database.User.update(args[0] + "@s.whatsapp.net", {
                    role: "free",
                    expired: 0,
                }).then(async () => {
                    await Chisato.sendText(from, `Successfully delete @${args[0]} from premium user`, message, {
                        mentions: [args[0] + "@s.whatsapp.net"],
                    });
                    Chisato.sendText(args[0] + "@s.whatsapp.net", `You are no longer premium user!`, message);
                });
            } else {
                Chisato.sendText(from, `@${args[0]} is not premium user`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
