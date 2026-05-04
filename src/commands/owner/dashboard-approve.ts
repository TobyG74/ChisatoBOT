import type { ConfigCommands } from "../../types/structure/commands";
import { handleLoginApproval } from "../../dashboard/routes/auth";

export default {
    name: "dashboardapprove",
    alias: ["dashapprove"],
    usage: "[approvalId]",
    category: "owner",
    description: "Approve pending dashboard login request",
    isOwner: true,
    isPrivate: true,
    async run({ Chisato, from, args, message, sender }) {
        const approvalId = args?.[0];

        if (!approvalId) {
            return Chisato.sendText(from, "❌ Approval ID tidak ditemukan.", message);
        }

        const ownerNumber = sender?.split("@")[0] || "unknown";
        const result = handleLoginApproval(approvalId, "approved", ownerNumber);

        await Chisato.sendText(from, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`, message);

        if (result.ok && result.loginPhone) {
            await Chisato.sendText(
                `${result.loginPhone}@s.whatsapp.net`,
                "✅ Login dashboard kamu sudah di-approve oleh owner. Silakan lanjut di halaman login.",
                message
            );
        }
    },
} satisfies ConfigCommands;
