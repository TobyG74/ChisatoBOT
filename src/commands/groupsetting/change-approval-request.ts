import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "approval",
    alias: ["approvalmode", "joinapproval"],
    category: "group setting",
    description: "Require admin approval for join requests",
    usage: "<on/off>",
    example: ".approval on\n.approval off\n.approval",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, args, message, Database, prefix }) {
        const groupSetting = await Database.Group.get(from);

        if (args.length === 0) {
            const status = groupSetting?.approval ? "REQUIRED" : "NOT REQUIRED";
            const emoji = groupSetting?.approval ? "✅" : "❌";
            
            let text = `*「 JOIN APPROVAL STATUS 」*\n\n`;
            text += `${emoji} Admin Approval: *${status}*\n\n`;
            text += `📝 *Description:*\n`;
            text += groupSetting?.approval
                ? `People must send join request and get admin approval to join this group.`
                : `People can join directly via invite link without admin approval.`;
            text += `\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}approval on\n`;
            text += `• ${prefix}approval off\n\n`;
            text += `🔒 *Note:* Bot must be admin to change this setting.`;

            return Chisato.sendText(from, text, message);
        }

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (groupSetting?.approval) {
                return Chisato.sendText(
                    from,
                    "❌ Join approval is already *required*!",
                    message
                );
            }

            await Chisato.groupJoinApprovalMode(from, "on");
            await Database.Group.update(from, { approval: true });

            let text = `*「 JOIN APPROVAL REQUIRED 」*\n\n`;
            text += `✅ Join approval has been *enabled*!\n\n`;
            text += `📝 People must now get admin approval to join this group via invite link.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!groupSetting?.approval) {
                return Chisato.sendText(
                    from,
                    "❌ Join approval is already *not required*!",
                    message
                );
            }

            await Chisato.groupJoinApprovalMode(from, "off");
            await Database.Group.update(from, { approval: false });

            let text = `*「 JOIN APPROVAL DISABLED 」*\n\n`;
            text += `✅ Join approval has been *disabled*!\n\n`;
            text += `🔓 People can now join directly via invite link without approval.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}approval on\n`;
            text += `• ${prefix}approval off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
