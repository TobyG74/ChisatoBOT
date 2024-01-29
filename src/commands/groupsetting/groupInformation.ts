import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "groupinfo",
    alias: ["ginfo", "groupinformation"],
    category: "group setting",
    description: "View Group Information.",
    isGroup: true,
    async run({ Chisato, from, message }) {
        const groupMetadata = await Chisato.groupMetadata(from);
        let str =
            `*「 GROUP INFORMATION 」*\n\n` +
            `• Name : ${groupMetadata.subject}\n` +
            `• Description : ${groupMetadata.desc || "-"}\n` +
            `• Owner : @${groupMetadata.owner.split("@")[0]}\n` +
            `• Member Count : ${groupMetadata.participants.length}\n` +
            `• Group Owner : ${groupMetadata.owner || "-"}\n` +
            `• Group Admins : ${groupMetadata.participants.filter((v) => v.admin === "admin").length}\n` +
            `• Group Created : ${new Date(groupMetadata.creation * 1000).toLocaleString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            })}\n`;
        try {
            const picture = await Chisato.profilePictureUrl(from, "image");
            await Chisato.sendImage(from, picture, str, message, {
                mentions: [groupMetadata.owner],
            });
        } catch {
            await Chisato.sendText(from, str, message, {
                mentions: [groupMetadata.owner],
            });
        }
    },
};
