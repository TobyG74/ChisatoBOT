import type { ConfigCommands } from "../../types/structure/commands";
import { handleLoginApproval, notifyTeamApprovalDecision } from "../../dashboard/routes/auth";

export default {
    name: "dashboardreject",
    alias: ["dashreject", "dashblock"],
    usage: "[approvalId]",
    category: "owner",
    description: "Reject a pending dashboard login & block the requester IP for that role",
    isOwner: true,
    isPrivate: true,
    async run({ Chisato, from, args, message, sender }) {
        const approvalId = args?.[0];

        if (!approvalId) {
            return Chisato.sendText(from, "❌ Approval ID tidak ditemukan.", message);
        }

        const actorPhone = sender?.split("@")[0] || "unknown";
        const result = await handleLoginApproval(approvalId, "block", actorPhone);

        await Chisato.sendText(from, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`, message);

        // Out-of-band notice for the team member if owner just blocked them.
        await notifyTeamApprovalDecision(result);
    },
} satisfies ConfigCommands;
