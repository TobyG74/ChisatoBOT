import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "groupinfo",
    alias: ["ginfo", "groupinformation"],
    category: "group setting",
    description: "View Group Information.",
    isGroup: true,
    async run({ Chisato, from, message }) {
        const groupMetadata = await Chisato.groupMetadata(from);
        const groupAdmins = groupMetadata.participants.filter((v) => v.admin !== null);
        let str =
            `*「 GROUP INFORMATION 」*\n\n` +
            `• Name : ${groupMetadata.subject}\n` +
            `• Description : ${groupMetadata.desc || "-"}\n` +
            `• Member Count : ${groupMetadata.participants.length}\n` +
            `• Group Owner : @${groupMetadata.owner.split("@")[0]}\n` +
            `• Group Owner : ${groupMetadata.owner || "-"}\n` +
            `• Group Admins : ${groupAdmins.length}\n`;
        for (let i = 0; i < groupAdmins.length; i++) {
            str += `└ @${groupAdmins[i].id.split("@")[0]}\n`;
        }
        str += `• Group Created : ${new Date(groupMetadata.creation * 1000).toLocaleString("en-US", {
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
                mentions: groupAdmins.map((v) => v.id),
            });
        } catch {
            await Chisato.sendText(from, str, message, {
                mentions: groupAdmins.map((v) => v.id),
            });
        }
    },
};
