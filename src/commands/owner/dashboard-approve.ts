import type { ConfigCommands } from "../../types/structure/commands";
import { handleLoginApproval, notifyTeamApprovalDecision } from "../../dashboard/routes/auth";

export default {
    name: "dashboardapprove",
    alias: ["dashapprove", "dashwhitelist"],
    usage: "[approvalId]",
    category: "owner",
    description: "Approve a pending dashboard login & whitelist the requester IP for that role",
    isOwner: true,
    isPrivate: true,
    async run({ Chisato, from, args, message, sender }) {
        const approvalId = args?.[0];

        if (!approvalId) {
            return Chisato.sendText(from, "❌ Approval ID tidak ditemukan.", message);
        }

        const actorPhone = sender?.split("@")[0] || "unknown";
        const result = await handleLoginApproval(approvalId, "whitelist", actorPhone);

        await Chisato.sendText(from, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`, message);

        // Send a friendly out-of-band notice to a team member when their login
        // was just approved by the owner (the dashboard UI will redirect them
        // automatically, but a WhatsApp ping is nice).
        await notifyTeamApprovalDecision(result);
    },
} satisfies ConfigCommands;
