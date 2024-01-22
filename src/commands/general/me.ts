import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "me",
    alias: ["myprofile", "myinfo"],
    category: "general",
    description: "User Profile",
    async run({ Chisato, sender, isOwner, from, message, userMetadata }) {
        const fetchStatus = await Chisato.fetchStatus(sender).catch(() => void 0);
        const caption =
            "*「 YOUR PROFILE 」*\n\n" +
            `• Name : ${message.pushName}\n` +
            `• Status : ${fetchStatus?.status || "-"}\n` +
            `└• Set At : ${fetchStatus?.setAt || "-"}\n` +
            `• Number : ${sender.replace(/@c.us/g, "")}\n` +
            `• Limit : ${
                isOwner ? "unlimited" : userMetadata.role === "premium" ? "unlimited" : userMetadata.limit
            }\n` +
            `• Role : ${isOwner ? "owner" : userMetadata.role}\n`;
        `• Banned : ${userMetadata.banned ? "YES" : "NO"}\n`;
        try {
            const profile = await Chisato.profilePictureUrl(sender, "image");
            await Chisato.sendImage(from, profile, caption, message);
            Chisato.sendContact(from, [sender]);
        } catch {
            await Chisato.sendText(from, caption, message);
            Chisato.sendContact(from, [sender]);
        }
    },
};
