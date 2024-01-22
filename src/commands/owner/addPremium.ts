import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "addpremium",
    alias: ["premium"],
    usage: "<tag>",
    category: "owner",
    description: "Add Premium User",
    isOwner: true,
    async run({ Chisato, args, from, message, Database }) {
        const expired = Date.now() + 2592000000;
        if (message.quoted) {
            let user = await Database.User.get(message.quoted.sender);
            if (user.role !== "premium") {
                await Database.User.update(message.quoted.sender, {
                    role: "premium",
                    expired: expired,
                }).then(async () => {
                    await Chisato.sendText(
                        from,
                        `Successfully add @${message.quoted.sender.split("@")[0]} to premium user`,
                        message,
                        {
                            mentions: [message.quoted.sender],
                        }
                    );
                    Chisato.sendText(
                        message.quoted.sender,
                        `You are now premium user!\n\nExpired Date : ${new Date(expired).toLocaleDateString()}`,
                        message
                    );
                });
            } else {
                Chisato.sendText(from, `@${message.quoted.sender.split("@")[0]} is already premium user`, message, {
                    mentions: [message.quoted.sender],
                });
            }
        } else if (message.mentions) {
            let caption = `Successfully add `;
            for (let i in message.mentions) {
                let user = await Database.User.get(message.mentions[i]);
                if (user.role !== "premium") {
                    await Database.User.update(message.mentions[i], {
                        role: "premium",
                        expired: expired,
                    }).then(() => {
                        caption += `@${message.mentions[i].split("@")[0]} `;
                    });
                } else {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                }
                Chisato.sendText(
                    message.mentions[i],
                    `You are now premium user!\n\nExpired Date : ${new Date(expired).toLocaleDateString()}`,
                    message
                );
            }
            caption += `to premium user`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            let user = await Database.User.get(args[0]);
            if (user.role !== "premium") {
                await Database.User.update(args[0] + "@s.whatsapp.net", { role: "premium", expired: expired }).then(
                    async () => {
                        await Chisato.sendText(from, `Successfully add @${args[0]} to premium user`, message, {
                            mentions: [args[0] + "@s.whatsapp.net"],
                        });
                        Chisato.sendText(
                            args[0] + "@s.whatsapp.net",
                            `You are now premium user!\n\nExpired Date : ${new Date(expired).toLocaleDateString()}`
                        );
                    }
                );
            } else {
                await Chisato.sendText(from, `@${args[0]} is already premium user`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            }
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
