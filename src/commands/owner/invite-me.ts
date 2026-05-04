import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "inviteme",
    alias: ["getinvite", "invitelink"],
    category: "owner",
    description: "Get invite link from group in list",
    usage: "[group_code]",
    example: `*「 INVITE ME 」*

🔗 Get invite link from group in list

📝 *Usage:*
{prefix}{command.name} [group_code]

💡 *Example:*
{prefix}{command.name} 1

📋 Use *{prefix}listgroup* to see all group codes`,
    isOwner: true,
    async run({ Chisato, message, from, args, prefix }) {
        const msg = message;
        await Chisato.sendReaction(from, "⏳", msg.key);

        const groupIndex = parseInt(args[0]) - 1;

        if (isNaN(groupIndex) || groupIndex < 0) {
            await Chisato.sendText(
                from,
                `❌ *Invalid Group Code!*\n\n` +
                    `Please provide a valid number from the group list.\n\n` +
                    `Use *${prefix}listgroup* to see all available groups.`,
                msg
            );
            await Chisato.sendReaction(from, "❌", msg.key);
            return;
        }

        try {
            const groups = await Chisato.groupFetchAllParticipating() as Record<string, any>;
            const groupList = Object.values(groups);

            groupList.sort((a: any, b: any) => b.participants.length - a.participants.length);

            if (groupIndex >= groupList.length) {
                await Chisato.sendText(
                    from,
                    `❌ *Group Not Found!*\n\n` +
                        `Group code ${args[0]} is not in the list.\n\n` +
                        `Total groups: ${groupList.length}\n\n` +
                        `Use *${prefix}listgroup* to see all available groups.`,
                    msg
                );
                await Chisato.sendReaction(from, "❌", msg.key);
                return;
            }

            const selectedGroup = groupList[groupIndex];
            const groupName = selectedGroup.subject || "Unknown";
            const groupId = selectedGroup.id;
            const memberCount = selectedGroup.participants.length;

            const isAdmin = selectedGroup.participants.some(
                (p) => p.id === Chisato.user.id && (p.admin === "admin" || p.admin === "superadmin")
            );

            if (!isAdmin) {
                await Chisato.sendText(
                    from,
                    `❌ *Bot is Not Admin!*\n\n` +
                        `Cannot get invite link for:\n` +
                        `📋 *Group:* ${groupName}\n` +
                        `👥 *Members:* ${memberCount}\n\n` +
                        `Bot needs to be an admin to generate invite links.\n\n` +
                        `Please promote bot to admin first.`,
                    msg
                );
                await Chisato.sendReaction(from, "❌", msg.key);
                return;
            }

            try {
                const inviteCode = await Chisato.groupInviteCode(groupId);
                const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

                let text = `*「 GROUP INVITE LINK 」*\n\n`;
                text += `✅ Successfully generated invite link!\n\n`;
                text += `📋 *Group Name:* ${groupName}\n`;
                text += `👥 *Members:* ${memberCount}\n`;
                text += `🆔 *Group ID:* ${groupId}\n\n`;
                text += `🔗 *Invite Link:*\n${inviteLink}\n\n`;
                text += `💡 Share this link to invite others to the group!`;

                await Chisato.sendText(from, text, msg);
                await Chisato.sendReaction(from, "✅", msg.key);
            } catch (error: any) {
                console.error("Get invite code error:", error);

                let errorMessage = "Failed to get invite link.";

                if (error.message?.includes("forbidden") || error.message?.includes("not-authorized")) {
                    errorMessage = "Bot doesn't have permission to generate invite links.";
                } else if (error.message) {
                    errorMessage = error.message;
                }

                await Chisato.sendText(
                    from,
                    `❌ *Failed to Get Invite Link!*\n\n` +
                        `📋 *Group:* ${groupName}\n\n` +
                        `${errorMessage}\n\n` +
                        `*Possible reasons:*\n` +
                        `• Bot is not admin\n` +
                        `• Insufficient permissions\n` +
                        `• Group settings restrict invite links`,
                    msg
                );
                await Chisato.sendReaction(from, "❌", msg.key);
            }
        } catch (error: any) {
            console.error("Invite me error:", error);
            await Chisato.sendText(
                from,
                `❌ *Failed to Process Request!*\n\n` +
                    `Error: ${error.message}\n\n` +
                    `Please try again later.`,
                msg
            );
            await Chisato.sendReaction(from, "❌", msg.key);
        }
    },
} satisfies ConfigCommands;
