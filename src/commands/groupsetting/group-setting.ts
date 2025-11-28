import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "gsetting",
    alias: ["groupsetting"],
    usage: "",
    category: "group setting",
    description: "View Settings.",
    isGroup: true,
    async run({ Chisato, from, message, Database, groupMetadata }) {
        const settings = await Database.Group.getSettings(from);
        
        if (!settings) {
            return Chisato.sendText(
                from,
                "❌ Failed to fetch group settings. Please try again.",
                message
            );
        }
        
        let str =
            `*「 GROUP METADATA SETTINGS 」*\n\n` +
            `「 ${groupMetadata?.["restrict"] ? "✅" : "❌"} 」 Restrict\n` +
            `「 ${groupMetadata?.["announce"] ? "✅" : "❌"} 」 Announcement\n` +
            `「 ${groupMetadata?.["memberAddMode"] ? "✅" : "❌"} 」 Member Add Mode\n` +
            `「 ${groupMetadata?.["joinApprovalMode"] ? "✅" : "❌"} 」 Approve New Members\n\n` +
            `*「 GROUP PRIVACY SETTINGS 」*\n\n` +
            `「 ${settings.antibot ? "✅" : "❌"} 」 Anti Bot\n` +
            `「 ${settings.antilink?.status ? "✅" : "❌"} 」 Anti Link\n` +
            `   └「 ${settings.antilink?.mode || "kick"} 」 Mode\n` +
            `   └「 ${settings.antilink?.list?.join(", ") || "none"} 」 List\n` +
            `「 ${settings.notify ? "✅" : "❌"} 」 Group Notify\n` +
            `「 ${settings.welcome ? "✅" : "❌"} 」 Welcome\n` +
            `「 ${settings.leave ? "✅" : "❌"} 」 Leave\n`;
        await Chisato.sendText(from, str, message);
    },
} satisfies ConfigCommands;