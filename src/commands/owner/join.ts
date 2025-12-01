import type { ConfigCommands } from "../../types/structure/commands";
import { sleep } from './../../utils/function';

export default {
    name: "join",
    alias: ["joingrup", "joingroup"],
    category: "owner",
    description: "Make bot join a group via invite link",
    usage: "[invite_link]",
    example: `*「 JOIN GROUP 」*

👥 Make bot join a group via invite link

📝 *Usage:*
{prefix}{command.name} <invite_link>

💡 *Example:*
{prefix}{command.name} https://chat.whatsapp.com/xxxxx

🔗 *Format:* Provide a valid WhatsApp group invite link`,
    isOwner: true,
    async run({ Chisato, message, args, from }) {
        const msg = message;
        await Chisato.sendReaction(from, "⏳", msg.key);

        const inviteLink = args[0];

        const inviteLinkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
        const match = inviteLink.match(inviteLinkRegex);

        if (!match) {
            await Chisato.sendText(from,
                `❌ *Invalid Invite Link!*\n\n` +
                    `Please provide a valid WhatsApp group invite link.\n\n` +
                    `*Format:*\n` +
                    `https://chat.whatsapp.com/xxxxx\n\n` +
                    `*Example:*\n` +
                    `.join https://chat.whatsapp.com/ABC123xyz456`,
            msg);
            await Chisato.sendReaction(from, "❌", msg.key);
            return;
        }

        const inviteCode = match[1];

        try {
            const groupInfo = await Chisato.groupGetInviteInfo(inviteCode);

            if (groupInfo.size && groupInfo.id) {
                try {
                    const metadata = await Chisato.groupMetadata(groupInfo.id);
                    if (metadata) {
                        await Chisato.sendText(from,
                            `⚠️ *Already in Group!*\n\n` +
                                `Bot is already a member of this group:\n\n` +
                                `📋 *Group Name:* ${groupInfo.subject || "Unknown"}\n` +
                                `👥 *Members:* ${groupInfo.size || 0}\n` +
                                `🆔 *Group ID:* ${groupInfo.id}`,
                        msg);
                        await Chisato.sendReaction(from, "⚠️", msg.key);
                        return;
                    }
                } catch (error) {}
            }

            const result = await Chisato.groupAcceptInvite(inviteCode);

            await Chisato.sendText(from,
                `✅ *Successfully Joined Group!*\n\n` +
                    `Bot has successfully joined the group:\n\n` +
                    `📋 *Group Name:* ${groupInfo.subject || "Unknown"}\n` +
                    `👥 *Members:* ${groupInfo.size || 0}\n` +
                    `🆔 *Group ID:* ${result || groupInfo.id}\n\n` +
                    `The bot is now active in this group!`,
            msg);
            
            await Chisato.sendReaction(from, "✅", msg.key);

            setTimeout(async () => {
                try {
                    const groupJid = result || groupInfo.id;
                    
                    await sleep(3000); 
                    
                    await Chisato.sendText(groupJid,
                        `👋 *Hello Everyone!*\n\n` +
                            `I'm ChisatoBot, thanks for inviting me to this group!\n\n` +
                            `Type *.menu* to see all available commands.\n\n` +
                            `Let's have fun together! 🎉`
                    );
                } catch (error) {
                    console.log("Note: Could not send greeting message to new group (this is normal)");
                }
            }, 5000);

        } catch (error: any) {
            console.error("Join group error:", error);

            let errorMessage = "Failed to join the group.";

            if (error.message?.includes("invalid")) {
                errorMessage = "The invite link is invalid or has expired.";
            } else if (error.message?.includes("forbidden")) {
                errorMessage = "Bot is not allowed to join this group (possibly banned or restricted).";
            } else if (error.message?.includes("gone")) {
                errorMessage = "The invite link has been revoked or the group no longer exists.";
            } else if (error.message) {
                errorMessage = error.message;
            }

            await Chisato.sendText(from,
                `❌ *Failed to Join Group!*\n\n` +
                    `${errorMessage}\n\n` +
                    `*Possible reasons:*\n` +
                    `• Invalid or expired invite link\n` +
                    `• Bot is banned from the group\n` +
                    `• Link has been revoked\n` +
                    `• Group no longer exists\n\n` +
                    `Please check the invite link and try again.`,
            msg);
            await Chisato.sendReaction(from, "❌", msg.key);
        }
    },
} satisfies ConfigCommands;
