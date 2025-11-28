import { Client } from "../../../libs/client/client";
import { MessageSerialize } from "../../../types/structure/serialize";
import { commands } from "../../../libs";
import { adminPanelSessions } from "../../../commands/owner/adminpanel";

// Track last adminpanel invocation per user (for menu response handling)
const lastAdminPanelCall = new Map<string, number>();

export class SessionHandler {
    static async handle(
        Chisato: Client,
        message: MessageSerialize,
        context: any
    ): Promise<boolean> {
        // Only handle text messages from owner
        if (!context.isOwner || !message.body || message.fromMe) {
            return false;
        }

        const sender = context.sender;
        const hasSession = adminPanelSessions.has(sender);
        const lastCallTime = lastAdminPanelCall.get(sender);
        const now = Date.now();
        
        const isRecentCall = lastCallTime && (now - lastCallTime < 5 * 60 * 1000);
        const isMenuChoice = /^[1-5]$/.test(message.body.trim());
        
        if (!hasSession && !(isRecentCall && isMenuChoice)) {
            return false;
        }

        const adminPanel = commands.get("adminpanel");
        if (!adminPanel) {
            return false;
        }

        try {
            // Execute adminpanel command with user's message as args
            await adminPanel.run({
                Chisato,
                prefix: context.prefix,
                command: adminPanel,
                args: message.body.trim().split(/\s+/),
                from: message.from,
                message: message,
                sender: sender,
                isGroup: context.isGroup,
                isOwner: context.isOwner,
                groupMetadata: context.groupMetadata,
                groupAdmins: context.groupAdmins,
                userMetadata: context.userMetadata,
            });
            return true;
        } catch (error) {
            console.error("Session handler error:", error);
            return false;
        }
    }

    // Track when user calls adminpanel command
    static trackAdminPanelCall(sender: string) {
        lastAdminPanelCall.set(sender, Date.now());
        
        const now = Date.now();
        for (const [key, time] of lastAdminPanelCall.entries()) {
            if (now - time > 5 * 60 * 1000) {
                lastAdminPanelCall.delete(key);
            }
        }
    }
}
