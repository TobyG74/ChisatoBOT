import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "config",
    alias: ["botconfig"],
    category: "owner",
    description: "See Bot Config",
    isOwner: true,
    async run({ Chisato, from, message, botName }) {
        const { config } = Chisato;
        let caption = `*「 CONFIG 」*

★ Owner Number : [`;
        for (let owner of config.ownerNumber) {
            caption += ` ${owner} `;
        }
        caption +=
            `]\n` +
            `★ Bot Name : ${botName}\n` +
            `└「 ${config.version} 」 Version\n` +
            `└「 ${config.prefix} 」 Prefix\n` +
            `★ Stickers :\n` +
            `└★ Packname : ${config.stickers.packname}\n` +
            `└★ Authorname : ${config.stickers.author}\n` +
            `★ Settings :\n` +
            `└「 ${config.settings.ownerNotifyOnline ? "✅" : "❌"} 」 Bot Online Notification\n` +
            `└「 ${config.settings.useLimit ? "✅" : "❌"} 」 Use Limit\n` +
            `└「 ${config.settings.useCooldown ? "✅" : "❌"} 」 Use Cooldown\n` +
            `└「 ${config.settings.autoReadMessage ? "✅" : "❌"} 」 Auto Read Message\n` +
            `└「 ${config.settings.autoReadStatus ? "✅" : "❌"} 」 Auto Read Status\n` +
            `└「 ${config.settings.selfbot ? "✅" : "❌"} 」 Selfbot\n` +
            `★ Call :\n` +
            `└「 ${config.call.status} 」 Anti Call\n` +
            `★ Limit :\n` +
            `└「 ${config.limit.command} 」 Command\n`;
        await Chisato.sendText(from, caption, message);
    },
};
