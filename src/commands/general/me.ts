import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "me",
    alias: ["myprofile", "myinfo"],
    usage: "",
    category: "general",
    description: "User Profile",
    async run({ Chisato, sender, isOwner, from, message, userMetadata, groupSettingData, isGroup }) {
        const fetchStatus = await Chisato.fetchStatus(sender).catch(() => void 0);
        
        let caption =
            "*「 YOUR PROFILE 」*\n\n" +
            `• Name : ${message.pushName}\n` +
            `• Status : ${fetchStatus?.status || "-"}\n` +
            `└• Set At : ${fetchStatus?.setAt || "-"}\n` +
            `• Number : ${sender.replace(/@s.whatsapp.net/g, "")}\n` +
            `• Limit : ${
                isOwner ? "unlimited" : userMetadata.role === "premium" ? "unlimited" : userMetadata.limit
            }\n` +
            `• Role : ${isOwner ? "owner" : userMetadata.role}\n`;
        
        if (isGroup && groupSettingData) {
            caption += `• Banned : ${groupSettingData.banned?.includes(sender) ? "YES" : "NO"}\n`;
        }

        try {
            const profile = await Chisato.profilePictureUrl(sender, "image");
            await Chisato.sendImage(from, profile, caption, message);
            Chisato.sendContact(from, [sender]);
        } catch {
            await Chisato.sendText(from, caption, message);
            Chisato.sendContact(from, [sender]);
        }
    },
} satisfies ConfigCommands;