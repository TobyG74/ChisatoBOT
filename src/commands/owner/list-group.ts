import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "listgroup",
    alias: ["grouplist", "listgrup"],
    category: "owner",
    description: "Display list of all groups where bot is a member",
    isOwner: true,
    async run({ Chisato, message, from, prefix }) {
        const msg = message;
        await Chisato.sendReaction(from, "⏳", msg.key);

        try {
            const groups = await Chisato.groupFetchAllParticipating();
            const groupList = Object.values(groups);

            if (groupList.length === 0) {
                await Chisato.sendText(
                    from,
                    `📋 *LIST GROUP*\n\n` +
                        `Bot is not a member of any groups yet.\n\n` +
                        `Use *${prefix}join* command to join groups.`,
                    msg
                );
                await Chisato.sendReaction(from, "ℹ️", msg.key);
                return;
            }

            groupList.sort((a, b) => b.participants.length - a.participants.length);

            let text = `*「 LIST GROUP 」*\n\n`;
            text += `📊 Total Groups: ${groupList.length}\n\n`;

            groupList.forEach((group, index) => {
                const groupName = group.subject || "Unknown";
                const groupId = group.id;
                const memberCount = group.participants.length;
                const isAdmin = group.participants.some(
                    (p) => p.id === Chisato.user.id && (p.admin === "admin" || p.admin === "superadmin")
                );

                text += `${index + 1}. ${groupName}\n`;
                text += `   • ID: ${groupId}\n`;
                text += `   • Members: ${memberCount}\n`;
                text += `   • Bot Role: ${isAdmin ? "Admin ⭐" : "Member"}\n`;
                text += `   • Code: *${index + 1}*\n\n`;
            });

            text += `\n💡 *Tip:*\n`;
            text += `Use *${prefix}inviteme [code]* to get invite link\n`;
            text += `Example: *${prefix}inviteme 1*`;

            await Chisato.sendText(from, text, msg);
            await Chisato.sendReaction(from, "✅", msg.key);
        } catch (error: any) {
            console.error("List group error:", error);
            await Chisato.sendText(
                from,
                `❌ *Failed to Get Group List!*\n\n` +
                    `Error: ${error.message}\n\n` +
                    `Please try again later.`,
                msg
            );
            await Chisato.sendReaction(from, "❌", msg.key);
        }
    },
} satisfies ConfigCommands;
