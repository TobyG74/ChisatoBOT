import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "gsetting",
    alias: ["groupsetting"],
    category: "group setting",
    description: "View Settings.",
    isGroup: true,
    async run({ Chisato, from, message, groupSettingData, groupMetadata }) {
        let str =
            `*「 GROUP METADATA SETTINGS 」*\n\n` +
            `「 ${groupMetadata["restrict"] ? "✅" : "❌"} 」 Restrict\n` +
            `「 ${groupMetadata["announce"] ? "✅" : "❌"} 」 Announcement\n` +
            `「 ${groupMetadata["memberAddMode"] ? "✅" : "❌"} 」 Member Add Mode\n` +
            `「 ${groupMetadata["approval"] ? "✅" : "❌"} 」 Approve New Members\n\n` +
            `*「 GROUP PRIVACY SETTINGS 」*\n\n` +
            `「 ${groupSettingData["antibot"] ? "✅" : "❌"} 」 Anti Bot\n` +
            `「 ${groupSettingData["antiviewonce"] ? "✅" : "❌"} 」 Anti View Once\n` +
            `「 ${groupSettingData["antilink"].status ? "✅" : "❌"} 」 Anti Link\n` +
            `   └「 ${groupSettingData["antilink"].mode} 」 Mode\n` +
            `   └「 ${groupSettingData["antilink"].list.join(", ")} 」 List\n` +
            `「 ${groupSettingData["notify"] ? "✅" : "❌"} 」 Group Notify\n` +
            `「 ${groupSettingData["welcome"] ? "✅" : "❌"} 」 Welcome\n` +
            `「 ${groupSettingData["leave"] ? "✅" : "❌"} 」 Leave\n`;
        await Chisato.sendText(from, str, message);
    },
};
